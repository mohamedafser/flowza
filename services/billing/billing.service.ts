import { AuthorizationError } from "@/lib/auth/guards";
import {
  BillingProviderError,
  DowngradeBlockedError,
  isDowngradeBlockedError,
  isSubscriptionLimitError,
} from "@/lib/billing/errors";
import { isEntitlementActive } from "@/lib/billing/status";
import type {
  BillingCycle,
  BillingOverview,
  CheckoutSession,
  PaymentRecord,
  PaymentStatus,
  PlanRecord,
  SubscriptionRecord,
  VerifyCheckoutInput,
} from "@/lib/billing/types";
import type { ActionErrorCode, ActionResult } from "@/lib/errors/action";
import { logSecurityEvent } from "@/lib/security/logging";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/services/audit";
import {
  assertDowngradeAllowed,
  buildUsageMeters,
} from "@/services/billing/entitlement.service";
import {
  getPlanByCode,
  isFreePlan,
  listActivePlans,
  planPrice,
} from "@/services/billing/plans";
import { getBillingProvider } from "@/services/billing/providers";
import {
  getCurrentPlan,
  getSubscription,
  getSubscriptionByProviderId,
  requireBillingManage,
  requireBillingView,
  trialDaysRemaining,
  upsertSubscriptionAdmin,
} from "@/services/billing/subscription.service";
import { getUsageSummary } from "@/services/billing/usage.service";
import type { Json } from "@/types/database";

export type BillingActionResult<T = undefined> = ActionResult<T> & {
  details?: Record<string, unknown>;
};

function periodLengthDays(cycle: BillingCycle): number {
  return cycle === "YEARLY" ? 365 : 30;
}

function addDays(iso: string | null | undefined, days: number): string {
  const base = iso ? new Date(iso) : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function unixToIso(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

export async function getBillingOverview(
  restaurantId: string,
): Promise<BillingOverview> {
  await requireBillingView(restaurantId);
  const [subscription, plan, plans] = await Promise.all([
    getSubscription(restaurantId),
    getCurrentPlan(restaurantId),
    listActivePlans(),
  ]);

  const supabase = await createClient();
  const [{ data: paymentRows }, usage] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50),
    getUsageSummary(
      restaurantId,
      subscription?.current_period_start,
      subscription?.current_period_end,
    ),
  ]);

  const payments = paymentRows ?? [];

  const provider = getBillingProvider();
  const billingCycle = subscription?.billing_cycle ?? "MONTHLY";
  const currentPrice = plan ? planPrice(plan, billingCycle) : null;
  const status = subscription?.status ?? "NONE";

  return {
    subscription,
    plan,
    plans,
    usage,
    meters: buildUsageMeters(usage, plan?.limits ?? null),
    payments,
    status,
    isActive: isEntitlementActive(status),
    isExpired: status === "EXPIRED" || status === "CANCELLED",
    isTrialing: status === "TRIALING",
    trialDaysRemaining: trialDaysRemaining(subscription),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    currentPrice,
    currency: plan?.currency ?? "INR",
    providerConfigured: provider.isConfigured(),
    publicKey: provider.getPublicKey(),
  };
}

export async function listPayments(
  restaurantId: string,
): Promise<PaymentRecord[]> {
  await requireBillingView(restaurantId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    return [];
  }

  return data;
}

export async function createCheckoutSession(input: {
  restaurantId: string;
  planCode: string;
  billingCycle: BillingCycle;
}): Promise<BillingActionResult<CheckoutSession>> {
  try {
    const context = await requireBillingManage(input.restaurantId);
    const plan = await getPlanByCode(input.planCode);
    if (!plan || !plan.is_active) {
      return { ok: false, code: "NOT_FOUND", message: "That plan is not available." };
    }

    const currentPlan = await getCurrentPlan(input.restaurantId);
    if (currentPlan && plan.sort_order < currentPlan.sort_order) {
      try {
        await assertDowngradeAllowed(input.restaurantId, plan);
      } catch (error) {
        if (isDowngradeBlockedError(error)) {
          return {
            ok: false,
            code: "CONFLICT",
            message: error.message,
            details: { conflicts: error.conflicts, code: error.code },
          };
        }
        throw error;
      }
    }

    if (isFreePlan(plan)) {
      const updated = await applyFreePlan({
        restaurantId: input.restaurantId,
        organizationId: context.organizationId,
        plan,
        userId: context.user.id,
        billingCycle: input.billingCycle,
      });
      return {
        ok: true,
        data: {
          subscriptionId: updated.id,
          providerSubscriptionId: "",
          providerCustomerId: null,
          keyId: "",
          amount: 0,
          currency: plan.currency,
          planCode: plan.code,
          billingCycle: input.billingCycle,
          name: plan.name,
          description: plan.description ?? plan.name,
          notes: { free: "1" },
        },
      };
    }

    const provider = getBillingProvider();
    if (!provider.isConfigured() || !provider.getPublicKey()) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: "Billing is not configured. Contact support.",
      };
    }

    const customerName =
      context.restaurant?.name ??
      context.profile?.full_name ??
      context.user.email ??
      "Restaurant";

    const customer = await provider.createCustomer({
      name: customerName,
      email: context.user.email,
      contact: context.restaurant?.phone,
      notes: {
        restaurant_id: input.restaurantId,
        organization_id: context.organizationId,
      },
    });

    const amount = planPrice(plan, input.billingCycle);
    const providerPlan = await provider.ensurePlan({
      code: plan.code,
      name: plan.name,
      amount,
      currency: plan.currency,
      billingCycle: input.billingCycle,
    });

    const totalCount = input.billingCycle === "YEARLY" ? 10 : 120;
    const providerSubscription = await provider.createSubscription({
      planId: providerPlan.id,
      customerId: customer.id,
      totalCount,
      notes: {
        restaurant_id: input.restaurantId,
        organization_id: context.organizationId,
        plan_code: plan.code,
        billing_cycle: input.billingCycle,
      },
    });

    await upsertSubscriptionAdmin({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      plan: currentPlan ?? plan,
      billingCycle: input.billingCycle,
      status: (await getSubscription(input.restaurantId))?.status ?? "TRIALING",
      provider: provider.name,
      providerCustomerId: customer.id,
      providerSubscriptionId: providerSubscription.id,
    });

    return {
      ok: true,
      data: {
        subscriptionId:
          (await getSubscription(input.restaurantId))?.id ??
          providerSubscription.id,
        providerSubscriptionId: providerSubscription.id,
        providerCustomerId: customer.id,
        keyId: provider.getPublicKey()!,
        amount,
        currency: plan.currency,
        planCode: plan.code,
        billingCycle: input.billingCycle,
        name: plan.name,
        description: plan.description ?? `${plan.name} subscription`,
        notes: {
          restaurant_id: input.restaurantId,
          plan_code: plan.code,
          billing_cycle: input.billingCycle,
        },
      },
    };
  } catch (error) {
    return mapBillingError(error, "Unable to start checkout.");
  }
}

export async function verifyCheckoutPayment(
  input: VerifyCheckoutInput,
): Promise<BillingActionResult<SubscriptionRecord>> {
  try {
    const context = await requireBillingManage(input.restaurantId);
    const provider = getBillingProvider();
    if (!provider.isConfigured()) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: "Billing is not configured.",
      };
    }

    const valid = provider.verifyCheckoutSignature({
      paymentId: input.razorpayPaymentId,
      subscriptionId: input.razorpaySubscriptionId,
      signature: input.razorpaySignature,
    });

    if (!valid) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Payment could not be verified.",
      };
    }

    const providerSubscription = await provider.getSubscription(
      input.razorpaySubscriptionId,
    );
    const notes = providerSubscription.notes ?? {};
    const noteRestaurantId = notes.restaurant_id?.trim() || null;
    const notePlanCode = notes.plan_code?.trim() || null;
    const noteBillingCycle = notes.billing_cycle?.trim() || null;

    if (noteRestaurantId) {
      if (noteRestaurantId !== input.restaurantId) {
        logSecurityEvent("SUSPICIOUS_REQUEST", {
          action: "checkout_verify_tenant_mismatch",
          restaurantId: input.restaurantId,
        });
        return {
          ok: false,
          code: "FORBIDDEN",
          message: "Payment could not be verified for this restaurant.",
        };
      }
    } else {
      const existing = await getSubscription(input.restaurantId);
      if (existing?.provider_subscription_id !== input.razorpaySubscriptionId) {
        return {
          ok: false,
          code: "VALIDATION",
          message: "Payment could not be verified for this restaurant.",
        };
      }
    }

    const resolvedPlanCode = notePlanCode || input.planCode;
    const plan = await getPlanByCode(resolvedPlanCode);
    if (!plan) {
      return { ok: false, code: "NOT_FOUND", message: "That plan is not available." };
    }

    const billingCycle =
      noteBillingCycle === "YEARLY" || noteBillingCycle === "MONTHLY"
        ? noteBillingCycle
        : input.billingCycle;

    const currentPlan = await getCurrentPlan(input.restaurantId);
    if (currentPlan && plan.sort_order < currentPlan.sort_order) {
      await assertDowngradeAllowed(input.restaurantId, plan);
    }

    const periodStart =
      unixToIso(providerSubscription.currentStart) ?? new Date().toISOString();
    const periodEnd =
      unixToIso(providerSubscription.currentEnd) ??
      addDays(periodStart, periodLengthDays(billingCycle));

    const subscription = await upsertSubscriptionAdmin({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      plan,
      billingCycle,
      status: "ACTIVE",
      provider: provider.name,
      providerSubscriptionId: input.razorpaySubscriptionId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      trialStart: null,
      trialEnd: null,
    });

    await recordPaymentAdmin({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      subscriptionId: subscription.id,
      amount: planPrice(plan, billingCycle),
      currency: plan.currency,
      status: "SUCCESS",
      provider: provider.name,
      providerPaymentId: input.razorpayPaymentId,
      billingCycle,
      description: `${plan.name} (${billingCycle.toLowerCase()})`,
      paidAt: new Date().toISOString(),
    });

    const previousCode = currentPlan?.code ?? null;
    await writeAuditLog({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      userId: context.user.id,
      action:
        previousCode && previousCode !== plan.code
          ? plan.sort_order > (currentPlan?.sort_order ?? 0)
            ? "subscription.upgraded"
            : "subscription.downgraded"
          : "subscription.updated",
      entityType: "subscription",
      entityId: subscription.id,
      metadata: {
        plan: plan.code,
        billingCycle,
        provider: provider.name,
      },
    });

    await writeAuditLog({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      userId: context.user.id,
      action: "payment.succeeded",
      entityType: "payment",
      entityId: input.razorpayPaymentId,
      metadata: {
        plan: plan.code,
        amount: planPrice(plan, billingCycle),
        currency: plan.currency,
      },
    });

    return { ok: true, data: subscription };
  } catch (error) {
    return mapBillingError(error, "Unable to verify payment.");
  }
}

export async function cancelSubscription(input: {
  restaurantId: string;
}): Promise<BillingActionResult<SubscriptionRecord>> {
  try {
    const context = await requireBillingManage(input.restaurantId);
    const subscription = await getSubscription(input.restaurantId);
    if (!subscription) {
      return { ok: false, code: "NOT_FOUND", message: "No subscription found." };
    }

    const provider = getBillingProvider();
    if (
      subscription.provider_subscription_id &&
      provider.isConfigured() &&
      subscription.provider === provider.name
    ) {
      await provider.cancelSubscription({
        subscriptionId: subscription.provider_subscription_id,
        cancelAtCycleEnd: true,
      });
    }

    const plan = (await getCurrentPlan(input.restaurantId)) ?? (await getPlanByCode("FREE"))!;
    const updated = await upsertSubscriptionAdmin({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      plan,
      billingCycle: subscription.billing_cycle,
      status: subscription.status,
      cancelAtPeriodEnd: true,
      cancelledAt: new Date().toISOString(),
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      provider: subscription.provider,
      providerCustomerId: subscription.provider_customer_id,
      providerSubscriptionId: subscription.provider_subscription_id,
    });

    await writeAuditLog({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      userId: context.user.id,
      action: "subscription.cancelled",
      entityType: "subscription",
      entityId: updated.id,
      metadata: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: updated.current_period_end,
      },
    });

    return { ok: true, data: updated };
  } catch (error) {
    return mapBillingError(error, "Unable to cancel subscription.");
  }
}

export async function reactivateSubscription(input: {
  restaurantId: string;
}): Promise<BillingActionResult<SubscriptionRecord>> {
  try {
    const context = await requireBillingManage(input.restaurantId);
    const subscription = await getSubscription(input.restaurantId);
    if (!subscription) {
      return { ok: false, code: "NOT_FOUND", message: "No subscription found." };
    }

    if (!subscription.cancel_at_period_end) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "This subscription is not scheduled for cancellation.",
      };
    }

    const provider = getBillingProvider();
    if (
      subscription.provider_subscription_id &&
      provider.isConfigured() &&
      subscription.provider === provider.name
    ) {
      await provider.resumeSubscription(subscription.provider_subscription_id);
    }

    const plan = (await getCurrentPlan(input.restaurantId)) ?? (await getPlanByCode("FREE"))!;
    const updated = await upsertSubscriptionAdmin({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      plan,
      billingCycle: subscription.billing_cycle,
      status: subscription.status === "CANCELLED" ? "ACTIVE" : subscription.status,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      provider: subscription.provider,
      providerCustomerId: subscription.provider_customer_id,
      providerSubscriptionId: subscription.provider_subscription_id,
    });

    await writeAuditLog({
      restaurantId: input.restaurantId,
      organizationId: context.organizationId,
      userId: context.user.id,
      action: "subscription.reactivated",
      entityType: "subscription",
      entityId: updated.id,
      metadata: { plan: plan.code },
    });

    return { ok: true, data: updated };
  } catch (error) {
    return mapBillingError(error, "Unable to reactivate subscription.");
  }
}

async function applyFreePlan(input: {
  restaurantId: string;
  organizationId: string;
  plan: PlanRecord;
  userId: string;
  billingCycle: BillingCycle;
}): Promise<SubscriptionRecord> {
  const currentPlan = await getCurrentPlan(input.restaurantId);
  if (currentPlan && input.plan.sort_order < currentPlan.sort_order) {
    await assertDowngradeAllowed(input.restaurantId, input.plan);
  }

  const now = new Date().toISOString();
  const updated = await upsertSubscriptionAdmin({
    restaurantId: input.restaurantId,
    organizationId: input.organizationId,
    plan: input.plan,
    billingCycle: input.billingCycle,
    status: "ACTIVE",
    provider: null,
    providerCustomerId: null,
    providerSubscriptionId: null,
    currentPeriodStart: now,
    currentPeriodEnd: addDays(now, periodLengthDays(input.billingCycle)),
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    trialStart: null,
    trialEnd: null,
  });

  await writeAuditLog({
    restaurantId: input.restaurantId,
    organizationId: input.organizationId,
    userId: input.userId,
    action:
      currentPlan && currentPlan.code !== input.plan.code
        ? "subscription.downgraded"
        : "subscription.updated",
    entityType: "subscription",
    entityId: updated.id,
    metadata: { plan: input.plan.code },
  });

  return updated;
}

export async function recordPaymentAdmin(input: {
  restaurantId: string;
  organizationId: string;
  subscriptionId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  providerPaymentId?: string | null;
  providerInvoiceId?: string | null;
  invoiceNumber?: string | null;
  billingCycle?: BillingCycle | null;
  description?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  metadata?: Record<string, Json | undefined>;
}): Promise<PaymentRecord | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  if (input.providerPaymentId) {
    const { data: existing } = await admin
      .from("payments")
      .select("*")
      .eq("provider", input.provider ?? "")
      .eq("provider_payment_id", input.providerPaymentId)
      .maybeSingle();
    if (existing) return existing;
  }

  const metadata: Record<string, Json> = {};
  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (value !== undefined) metadata[key] = value;
  }

  const { data, error } = await admin
    .from("payments")
    .insert({
      restaurant_id: input.restaurantId,
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      provider: input.provider,
      provider_payment_id: input.providerPaymentId ?? null,
      provider_invoice_id: input.providerInvoiceId ?? null,
      invoice_number: input.invoiceNumber ?? null,
      billing_cycle: input.billingCycle ?? null,
      description: input.description ?? null,
      failure_reason: input.failureReason ?? null,
      paid_at: input.paidAt ?? null,
      metadata,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function processRazorpayWebhook(input: {
  rawBody: string;
  signature: string | null;
  eventId: string | null;
}): Promise<{ ok: true; duplicate?: boolean } | { ok: false; message: string }> {
  const provider = getBillingProvider();
  if (!provider.verifyWebhook({ rawBody: input.rawBody, signature: input.signature })) {
    logSecurityEvent("WEBHOOK_SIGNATURE_FAILURE", {
      provider: "RAZORPAY",
      hasSignature: Boolean(input.signature),
      eventId: input.eventId ? "[present]" : null,
    });
    return { ok: false, message: "Invalid webhook signature." };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(input.rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, message: "Invalid webhook payload." };
  }

  const eventType = String(payload.event ?? "unknown");
  const eventId =
    input.eventId?.trim() ||
    (typeof payload.id === "string" ? payload.id.trim() : "");

  if (!eventId) {
    return { ok: false, message: "Missing webhook event id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Service role is not configured." };
  }

  const { data: inserted, error: insertError } = await admin
    .from("webhook_events")
    .insert({
      provider: "RAZORPAY",
      event_id: eventId,
      event_type: eventType,
      payload: payload as Json,
    })
    .select("id, processed_at")
    .maybeSingle();

  if (insertError) {
    if (/duplicate|unique/i.test(insertError.message)) {
      const { data: existing } = await admin
        .from("webhook_events")
        .select("id, processed_at, processing_error")
        .eq("provider", "RAZORPAY")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existing?.processed_at) {
        return { ok: true, duplicate: true };
      }

      // Prior attempt failed — retry processing once.
      try {
        await handleRazorpayEvent(eventType, payload);
        if (existing?.id) {
          await admin
            .from("webhook_events")
            .update({
              processed_at: new Date().toISOString(),
              processing_error: null,
            })
            .eq("id", existing.id);
        }
        return { ok: true };
      } catch {
        return { ok: false, message: "Webhook processing failed." };
      }
    }
    return { ok: false, message: "Unable to record webhook event." };
  }

  try {
    await handleRazorpayEvent(eventType, payload);
    if (inserted?.id) {
      await admin
        .from("webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", inserted.id);
    }
    return { ok: true };
  } catch (error) {
    if (inserted?.id) {
      await admin
        .from("webhook_events")
        .update({
          processing_error:
            error instanceof Error ? error.message : "Processing failed",
        })
        .eq("id", inserted.id);
    }
    return { ok: false, message: "Webhook processing failed." };
  }
}

async function handleRazorpayEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const nested = payload.payload as Record<string, unknown> | undefined;
  const subscriptionEntity =
    (nested?.subscription as { entity?: Record<string, unknown> } | undefined)
      ?.entity ?? null;
  const paymentEntity =
    (nested?.payment as { entity?: Record<string, unknown> } | undefined)
      ?.entity ?? null;

  const providerSubscriptionId =
    typeof subscriptionEntity?.id === "string" ? subscriptionEntity.id : null;

  if (!providerSubscriptionId) {
    return;
  }

  const subscription = await getSubscriptionByProviderId(
    "RAZORPAY",
    providerSubscriptionId,
  );
  if (!subscription) {
    return;
  }

  const plan =
    (await getCurrentPlan(subscription.restaurant_id)) ??
    (await getPlanByCode(subscription.plan)) ??
    (await getPlanByCode("FREE"));

  if (!plan) return;

  switch (eventType) {
    case "subscription.activated":
    case "subscription.charged": {
      await upsertSubscriptionAdmin({
        restaurantId: subscription.restaurant_id,
        organizationId: subscription.organization_id,
        plan,
        billingCycle: subscription.billing_cycle,
        status: "ACTIVE",
        provider: "RAZORPAY",
        providerCustomerId: subscription.provider_customer_id,
        providerSubscriptionId,
        currentPeriodStart:
          unixToIso(
            typeof subscriptionEntity?.current_start === "number"
              ? subscriptionEntity.current_start
              : null,
          ) ?? subscription.current_period_start,
        currentPeriodEnd:
          unixToIso(
            typeof subscriptionEntity?.current_end === "number"
              ? subscriptionEntity.current_end
              : null,
          ) ?? subscription.current_period_end,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      });

      if (paymentEntity && typeof paymentEntity.id === "string") {
        const amountPaise =
          typeof paymentEntity.amount === "number" ? paymentEntity.amount : 0;
        await recordPaymentAdmin({
          restaurantId: subscription.restaurant_id,
          organizationId: subscription.organization_id,
          subscriptionId: subscription.id,
          amount: amountPaise / 100,
          currency:
            typeof paymentEntity.currency === "string"
              ? paymentEntity.currency.toUpperCase()
              : plan.currency,
          status: "SUCCESS",
          provider: "RAZORPAY",
          providerPaymentId: paymentEntity.id,
          providerInvoiceId:
            typeof paymentEntity.invoice_id === "string"
              ? paymentEntity.invoice_id
              : null,
          billingCycle: subscription.billing_cycle,
          paidAt: new Date().toISOString(),
          description: `${plan.name} subscription charge`,
        });

        await writeAuditLog({
          restaurantId: subscription.restaurant_id,
          organizationId: subscription.organization_id,
          userId: null,
          action: "payment.succeeded",
          entityType: "payment",
          entityId: paymentEntity.id,
          metadata: { eventType, plan: plan.code },
        });
      }
      break;
    }
    case "subscription.pending":
    case "subscription.halted": {
      await upsertSubscriptionAdmin({
        restaurantId: subscription.restaurant_id,
        organizationId: subscription.organization_id,
        plan,
        billingCycle: subscription.billing_cycle,
        status: "PAST_DUE",
        provider: "RAZORPAY",
        providerSubscriptionId,
        providerCustomerId: subscription.provider_customer_id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
      });

      if (paymentEntity && typeof paymentEntity.id === "string") {
        await recordPaymentAdmin({
          restaurantId: subscription.restaurant_id,
          organizationId: subscription.organization_id,
          subscriptionId: subscription.id,
          amount:
            typeof paymentEntity.amount === "number"
              ? paymentEntity.amount / 100
              : 0,
          currency:
            typeof paymentEntity.currency === "string"
              ? paymentEntity.currency.toUpperCase()
              : plan.currency,
          status: "FAILED",
          provider: "RAZORPAY",
          providerPaymentId: paymentEntity.id,
          failureReason: "Payment failed",
          description: `${plan.name} payment failed`,
        });

        await writeAuditLog({
          restaurantId: subscription.restaurant_id,
          organizationId: subscription.organization_id,
          userId: null,
          action: "payment.failed",
          entityType: "payment",
          entityId: paymentEntity.id,
          metadata: { eventType, plan: plan.code },
        });
      }
      break;
    }
    case "subscription.cancelled": {
      await upsertSubscriptionAdmin({
        restaurantId: subscription.restaurant_id,
        organizationId: subscription.organization_id,
        plan,
        billingCycle: subscription.billing_cycle,
        status: "CANCELLED",
        provider: "RAZORPAY",
        providerSubscriptionId,
        providerCustomerId: subscription.provider_customer_id,
        cancelAtPeriodEnd: false,
        cancelledAt: new Date().toISOString(),
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
      });
      break;
    }
    case "payment.failed": {
      if (paymentEntity && typeof paymentEntity.id === "string") {
        await recordPaymentAdmin({
          restaurantId: subscription.restaurant_id,
          organizationId: subscription.organization_id,
          subscriptionId: subscription.id,
          amount:
            typeof paymentEntity.amount === "number"
              ? paymentEntity.amount / 100
              : 0,
          currency:
            typeof paymentEntity.currency === "string"
              ? paymentEntity.currency.toUpperCase()
              : plan.currency,
          status: "FAILED",
          provider: "RAZORPAY",
          providerPaymentId: paymentEntity.id,
          failureReason: "Payment failed",
        });
        await writeAuditLog({
          restaurantId: subscription.restaurant_id,
          organizationId: subscription.organization_id,
          userId: null,
          action: "payment.failed",
          entityType: "payment",
          entityId: paymentEntity.id,
          metadata: { eventType },
        });
      }
      await upsertSubscriptionAdmin({
        restaurantId: subscription.restaurant_id,
        organizationId: subscription.organization_id,
        plan,
        billingCycle: subscription.billing_cycle,
        status: "PAST_DUE",
        provider: "RAZORPAY",
        providerSubscriptionId,
        providerCustomerId: subscription.provider_customer_id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
      });
      break;
    }
    default:
      // Unknown events are recorded but ignored.
      break;
  }
}

function mapBillingError(
  error: unknown,
  fallback: string,
): BillingActionResult<never> {
  if (error instanceof AuthorizationError) {
    return { ok: false, code: error.code, message: error.message };
  }
  if (isSubscriptionLimitError(error)) {
    return {
      ok: false,
      code: "SUBSCRIPTION_LIMIT_REACHED",
      message: error.message,
      details: error.toJSON(),
    };
  }
  if (isDowngradeBlockedError(error)) {
    return {
      ok: false,
      code: "SUBSCRIPTION_DOWNGRADE_BLOCKED",
      message: error.message,
      details: { code: error.code, conflicts: error.conflicts },
    };
  }
  if (error instanceof BillingProviderError) {
    return { ok: false, code: "UNKNOWN", message: error.message };
  }
  if (error instanceof DowngradeBlockedError) {
    return { ok: false, code: "CONFLICT", message: error.message };
  }
  return { ok: false, code: "UNKNOWN" as ActionErrorCode, message: fallback };
}
