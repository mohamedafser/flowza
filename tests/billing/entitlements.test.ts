import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DowngradeBlockedError,
  SubscriptionLimitError,
  formatDowngradeMessage,
  formatLimitMessage,
} from "@/lib/billing/errors";
import { isEntitlementActive, isTerminalSubscriptionStatus } from "@/lib/billing/status";
import {
  findDowngradeConflicts,
  buildUsageMeters,
} from "@/services/billing/entitlement.service";
import {
  parsePlanFeatures,
  parsePlanLimits,
  limitForResource,
  usageForResource,
  type PlanLimits,
  type PlanRecord,
  type UsageSummary,
} from "@/lib/billing/types";
import { trialDaysRemaining } from "@/services/billing/subscription.service";
import { RazorpayBillingProvider } from "@/services/billing/providers/razorpay.provider";
import { hasPermission } from "@/lib/auth/permissions";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_BILLING_PATH } from "@/lib/auth/paths";

const starterLimits: PlanLimits = {
  max_branches: 2,
  max_staff: 10,
  max_tables: 25,
  max_queue_entries_per_month: 1000,
  max_reservations_per_month: 500,
  max_displays: 2,
};

const usage: UsageSummary = {
  branches: 2,
  staff: 7,
  tables: 18,
  queue_entries: 743,
  reservations: 40,
  displays: 1,
  period_start: "2026-09-01T00:00:00.000Z",
  period_end: "2026-09-22T00:00:00.000Z",
};

describe("billing plan parsing", () => {
  it("parses limits and features from jsonb-shaped values", () => {
    const limits = parsePlanLimits({
      max_branches: 2,
      max_staff: 10,
      max_tables: 25,
      max_queue_entries_per_month: 1000,
      max_reservations_per_month: 500,
      max_displays: 2,
    });
    const features = parsePlanFeatures({
      reservations: true,
      analytics: true,
      advanced_analytics: false,
    });

    expect(limits.max_branches).toBe(2);
    expect(features.reservations).toBe(true);
    expect(features.advanced_analytics).toBe(false);
    expect(limitForResource(limits, "queue_entries")).toBe(1000);
    expect(usageForResource(usage, "staff")).toBe(7);
  });
});

describe("subscription status helpers", () => {
  it("treats trialing/active/past_due/paused as entitled", () => {
    expect(isEntitlementActive("TRIALING")).toBe(true);
    expect(isEntitlementActive("ACTIVE")).toBe(true);
    expect(isEntitlementActive("PAST_DUE")).toBe(true);
    expect(isEntitlementActive("PAUSED")).toBe(true);
    expect(isEntitlementActive("EXPIRED")).toBe(false);
    expect(isTerminalSubscriptionStatus("CANCELLED")).toBe(true);
  });

  it("computes remaining trial days", () => {
    const now = new Date("2026-09-22T00:00:00.000Z");
    const days = trialDaysRemaining(
      {
        id: "sub",
        restaurant_id: "r1",
        organization_id: "o1",
        plan_id: null,
        plan: "FREE",
        status: "TRIALING",
        billing_cycle: "MONTHLY",
        provider: null,
        provider_customer_id: null,
        provider_subscription_id: null,
        current_period_start: now.toISOString(),
        current_period_end: "2026-09-29T00:00:00.000Z",
        trial_start: now.toISOString(),
        trial_end: "2026-09-29T00:00:00.000Z",
        cancel_at_period_end: false,
        cancelled_at: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      now,
    );
    expect(days).toBe(7);
  });
});

describe("entitlements and usage limits", () => {
  it("builds accessible usage meters", () => {
    const meters = buildUsageMeters(usage, starterLimits);
    const branches = meters.find((m) => m.resource === "branches");
    expect(branches?.current).toBe(2);
    expect(branches?.limit).toBe(2);
  });

  it("detects limit reached messaging", () => {
    const error = new SubscriptionLimitError({
      resource: "branches",
      currentUsage: 2,
      limit: 2,
      plan: "Starter",
    });
    expect(error.code).toBe("SUBSCRIPTION_LIMIT_REACHED");
    expect(formatLimitMessage("branches", "Starter")).toContain(
      "branches limit for the Starter plan",
    );
    expect(error.toJSON().resource).toBe("branches");
  });

  it("blocks downgrades when usage exceeds target limits", () => {
    const target: PlanLimits = {
      ...starterLimits,
      max_branches: 1,
      max_staff: 2,
    };
    const conflicts = findDowngradeConflicts(usage, target);
    expect(conflicts.some((c) => c.resource === "branches")).toBe(true);
    expect(conflicts.some((c) => c.resource === "staff")).toBe(true);

    const error = new DowngradeBlockedError("Free", conflicts);
    expect(error.code).toBe("SUBSCRIPTION_DOWNGRADE_BLOCKED");
    expect(formatDowngradeMessage("Free", conflicts)).toContain(
      "supports only",
    );
  });

  it("allows downgrade when usage fits", () => {
    const lightUsage: UsageSummary = {
      ...usage,
      branches: 1,
      staff: 2,
      tables: 2,
      displays: 0,
    };
    expect(findDowngradeConflicts(lightUsage, starterLimits)).toEqual([]);
  });
});

describe("billing permissions and route access", () => {
  it("allows owner to manage billing and admin to view only", () => {
    expect(hasPermission("OWNER", "billing.manage")).toBe(true);
    expect(hasPermission("OWNER", "billing.subscription.manage")).toBe(true);
    expect(hasPermission("ADMIN", "billing.view")).toBe(true);
    expect(hasPermission("ADMIN", "billing.manage")).toBe(false);
    expect(hasPermission("ADMIN", "billing.payment.view")).toBe(true);
    expect(hasPermission("MANAGER", "billing.view")).toBe(false);
    expect(hasPermission("STAFF", "billing.view")).toBe(false);
  });

  it("protects the billing settings route", () => {
    expect(canAccessHref("OWNER", SETTINGS_BILLING_PATH)).toBe(true);
    expect(canAccessHref("ADMIN", SETTINGS_BILLING_PATH)).toBe(true);
    expect(canAccessHref("MANAGER", SETTINGS_BILLING_PATH)).toBe(false);
    expect(canAccessHref("STAFF", SETTINGS_BILLING_PATH)).toBe(false);
  });
});

describe("razorpay provider security helpers", () => {
  it("verifies checkout signatures with timing-safe compare", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    const provider = new RazorpayBillingProvider();
    const paymentId = "pay_123";
    const subscriptionId = "sub_123";
    const signature = createHmac("sha256", "test_secret")
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");

    expect(
      provider.verifyCheckoutSignature({
        paymentId,
        subscriptionId,
        signature,
      }),
    ).toBe(true);
    expect(
      provider.verifyCheckoutSignature({
        paymentId,
        subscriptionId,
        signature: "deadbeef",
      }),
    ).toBe(false);
  });

  it("verifies webhook signatures and rejects invalid ones", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
    const provider = new RazorpayBillingProvider();
    const rawBody = JSON.stringify({ event: "subscription.activated" });
    const signature = createHmac("sha256", "whsec_test")
      .update(rawBody)
      .digest("hex");

    expect(provider.verifyWebhook({ rawBody, signature })).toBe(true);
    expect(
      provider.verifyWebhook({ rawBody, signature: "invalid" }),
    ).toBe(false);
    expect(provider.verifyWebhook({ rawBody, signature: null })).toBe(false);
  });

  it("reports configuration state from env", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    const provider = new RazorpayBillingProvider();
    expect(provider.isConfigured()).toBe(true);
    expect(provider.getPublicKey()).toBe("rzp_test_key");
  });
});

describe("plan catalog helpers", () => {
  it("keeps example starter limits centralized", () => {
    const plan = {
      code: "STARTER",
      name: "Starter",
      limits: starterLimits,
      features: { reservations: true, tv_displays: true },
      monthly_price: 1499,
      yearly_price: 14990,
      currency: "INR",
      sort_order: 20,
    } as PlanRecord;

    expect(plan.limits.max_branches).toBe(2);
    expect(plan.features.reservations).toBe(true);
  });
});
