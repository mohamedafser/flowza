import { createHmac, timingSafeEqual } from "node:crypto";
import { BillingProviderError } from "@/lib/billing/errors";
import type {
  BillingProvider,
  ProviderCancelInput,
  ProviderCustomer,
  ProviderCustomerInput,
  ProviderPlan,
  ProviderPlanInput,
  ProviderSubscription,
  ProviderSubscriptionInput,
  ProviderVerifyPaymentInput,
  ProviderWebhookVerification,
} from "@/services/billing/providers/billing-provider";

const RAZORPAY_API = "https://api.razorpay.com/v1";

type RazorpayEnv = {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
};

function readEnv(): RazorpayEnv | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) {
    return null;
  }
  return {
    keyId,
    keySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null,
  };
}

function basicAuth(env: RazorpayEnv): string {
  return Buffer.from(`${env.keyId}:${env.keySecret}`).toString("base64");
}

function periodFromCycle(cycle: ProviderPlanInput["billingCycle"]): {
  period: "monthly" | "yearly";
  interval: number;
} {
  return cycle === "YEARLY"
    ? { period: "yearly", interval: 1 }
    : { period: "monthly", interval: 1 };
}

function toMinorUnits(amount: number, currency: string): number {
  // Most Razorpay currencies (including INR) use 2 decimal minor units.
  const normalized = currency.toUpperCase();
  if (normalized === "JPY") {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function mapSubscription(entity: Record<string, unknown>): ProviderSubscription {
  const rawNotes = entity.notes;
  const notes: Record<string, string> = {};
  if (rawNotes && typeof rawNotes === "object" && !Array.isArray(rawNotes)) {
    for (const [key, value] of Object.entries(
      rawNotes as Record<string, unknown>,
    )) {
      if (typeof value === "string" && value.length > 0) {
        notes[key] = value;
      }
    }
  }

  return {
    id: String(entity.id ?? ""),
    status: String(entity.status ?? ""),
    currentStart:
      typeof entity.current_start === "number" ? entity.current_start : null,
    currentEnd:
      typeof entity.current_end === "number" ? entity.current_end : null,
    chargeAt: typeof entity.charge_at === "number" ? entity.charge_at : null,
    notes,
  };
}

async function razorpayRequest<T>(
  env: RazorpayEnv,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${basicAuth(env)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const error =
      json && typeof json === "object" && "error" in json
        ? (json.error as { description?: string } | undefined)
        : undefined;
    throw new BillingProviderError(
      error?.description
        ? "Payment provider rejected the request. Please try again."
        : "Unable to reach the payment provider. Please try again.",
    );
  }

  return json as T;
}

/**
 * Razorpay implementation of BillingProvider.
 * Secrets stay server-side; only keyId is exposed to checkout.
 */
export class RazorpayBillingProvider implements BillingProvider {
  readonly name = "RAZORPAY" as const;

  isConfigured(): boolean {
    return readEnv() !== null;
  }

  getPublicKey(): string | null {
    return readEnv()?.keyId ?? null;
  }

  async createCustomer(
    input: ProviderCustomerInput,
  ): Promise<ProviderCustomer> {
    const env = readEnv();
    if (!env) {
      throw new BillingProviderError("Billing is not configured.");
    }

    const result = await razorpayRequest<{ id: string }>(env, "POST", "/customers", {
      name: input.name,
      email: input.email || undefined,
      contact: input.contact || undefined,
      notes: input.notes,
      fail_existing: "0",
    });

    return { id: result.id };
  }

  async ensurePlan(input: ProviderPlanInput): Promise<ProviderPlan> {
    const env = readEnv();
    if (!env) {
      throw new BillingProviderError("Billing is not configured.");
    }

    const { period, interval } = periodFromCycle(input.billingCycle);
    const item = {
      name: `${input.name} (${input.billingCycle.toLowerCase()})`,
      amount: toMinorUnits(input.amount, input.currency),
      currency: input.currency.toUpperCase(),
      description: `${input.code}:${input.billingCycle}`,
    };

    const result = await razorpayRequest<{ id: string }>(env, "POST", "/plans", {
      period,
      interval,
      item,
      notes: {
        flowza_plan_code: input.code,
        flowza_billing_cycle: input.billingCycle,
      },
    });

    return { id: result.id };
  }

  async createSubscription(
    input: ProviderSubscriptionInput,
  ): Promise<ProviderSubscription> {
    const env = readEnv();
    if (!env) {
      throw new BillingProviderError("Billing is not configured.");
    }

    const result = await razorpayRequest<Record<string, unknown>>(
      env,
      "POST",
      "/subscriptions",
      {
        plan_id: input.planId,
        customer_id: input.customerId,
        total_count: input.totalCount,
        customer_notify: input.customerNotify ?? 1,
        notes: input.notes,
      },
    );

    return mapSubscription(result);
  }

  async getSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription> {
    const env = readEnv();
    if (!env) {
      throw new BillingProviderError("Billing is not configured.");
    }

    const result = await razorpayRequest<Record<string, unknown>>(
      env,
      "GET",
      `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
    );

    return mapSubscription(result);
  }

  async cancelSubscription(
    input: ProviderCancelInput,
  ): Promise<ProviderSubscription> {
    const env = readEnv();
    if (!env) {
      throw new BillingProviderError("Billing is not configured.");
    }

    const result = await razorpayRequest<Record<string, unknown>>(
      env,
      "POST",
      `/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`,
      {
        cancel_at_cycle_end: input.cancelAtCycleEnd ? 1 : 0,
      },
    );

    return mapSubscription(result);
  }

  async resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription> {
    // Razorpay resumes scheduled cancellations via update/cancel reverse —
    // resume endpoint sets cancel_at_cycle_end false when still active.
    const env = readEnv();
    if (!env) {
      throw new BillingProviderError("Billing is not configured.");
    }

    const result = await razorpayRequest<Record<string, unknown>>(
      env,
      "PATCH",
      `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      {
        schedule_change_at: "now",
      },
    ).catch(async () => {
      // Fallback: fetch current subscription for local sync if resume unsupported.
      return razorpayRequest<Record<string, unknown>>(
        env,
        "GET",
        `/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      );
    });

    return mapSubscription(result);
  }

  verifyCheckoutSignature(input: ProviderVerifyPaymentInput): boolean {
    const env = readEnv();
    if (!env) return false;

    const payload = `${input.paymentId}|${input.subscriptionId}`;
    const expected = createHmac("sha256", env.keySecret)
      .update(payload)
      .digest("hex");
    return safeEqual(expected, input.signature);
  }

  verifyWebhook(input: ProviderWebhookVerification): boolean {
    const env = readEnv();
    if (!env?.webhookSecret || !input.signature) {
      return false;
    }
    const expected = createHmac("sha256", env.webhookSecret)
      .update(input.rawBody)
      .digest("hex");
    return safeEqual(expected, input.signature);
  }
}

let cachedProvider: RazorpayBillingProvider | null = null;

export function getRazorpayProvider(): RazorpayBillingProvider {
  if (!cachedProvider) {
    cachedProvider = new RazorpayBillingProvider();
  }
  return cachedProvider;
}
