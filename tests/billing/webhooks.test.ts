import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleClient: vi.fn(),
  isServiceRoleConfigured: vi.fn(() => true),
}));

vi.mock("@/services/billing/subscription.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/billing/subscription.service")
  >("@/services/billing/subscription.service");
  return {
    ...actual,
    getSubscriptionByProviderId: vi.fn(),
    upsertSubscriptionAdmin: vi.fn(),
    getCurrentPlan: vi.fn(),
  };
});

vi.mock("@/services/billing/plans", async () => {
  const actual = await vi.importActual<typeof import("@/services/billing/plans")>(
    "@/services/billing/plans",
  );
  return {
    ...actual,
    getPlanByCode: vi.fn(),
  };
});

vi.mock("@/services/audit", () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { processRazorpayWebhook } from "@/services/billing/billing.service";
import { getSubscriptionByProviderId } from "@/services/billing/subscription.service";
import { getPlanByCode } from "@/services/billing/plans";

describe("razorpay webhook processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
  });

  function sign(body: string) {
    return createHmac("sha256", "whsec_test").update(body).digest("hex");
  }

  it("rejects invalid signatures", async () => {
    const rawBody = JSON.stringify({ event: "subscription.activated" });
    const result = await processRazorpayWebhook({
      rawBody,
      signature: "bad",
      eventId: "evt_1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/signature/i);
    }
  });

  it("is idempotent for duplicate event ids", async () => {
    const rawBody = JSON.stringify({
      event: "subscription.activated",
      payload: {
        subscription: { entity: { id: "sub_abc", status: "active" } },
      },
    });

    const insert = vi.fn().mockReturnValueOnce({
      select: () => ({
        maybeSingle: async () => ({
          data: null,
          error: { message: "duplicate key value violates unique constraint" },
        }),
      }),
    });

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: () => ({
        insert,
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "row_1",
                  processed_at: "2026-01-01T00:00:00.000Z",
                  processing_error: null,
                },
              }),
            }),
          }),
        }),
      }),
    } as never);

    const result = await processRazorpayWebhook({
      rawBody,
      signature: sign(rawBody),
      eventId: "evt_dup",
    });

    expect(result).toEqual({ ok: true, duplicate: true });
  });

  it("rejects webhooks without a stable event id", async () => {
    const rawBody = JSON.stringify({ event: "subscription.activated" });
    const result = await processRazorpayWebhook({
      rawBody,
      signature: sign(rawBody),
      eventId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/event id/i);
    }
  });

  it("ignores unknown events after recording", async () => {
    const rawBody = JSON.stringify({
      event: "subscription.paused",
      payload: {
        subscription: { entity: { id: "sub_abc" } },
      },
    });

    const update = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({
          data: { id: "wh_1" },
          error: null,
        }),
      }),
    });

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: (table: string) => {
        if (table === "webhook_events") {
          return { insert, update };
        }
        return {};
      },
    } as never);

    vi.mocked(getSubscriptionByProviderId).mockResolvedValue({
      id: "local_sub",
      restaurant_id: "r1",
      organization_id: "o1",
      plan_id: null,
      plan: "STARTER",
      status: "ACTIVE",
      billing_cycle: "MONTHLY",
      provider: "RAZORPAY",
      provider_customer_id: "cust_1",
      provider_subscription_id: "sub_abc",
      current_period_start: null,
      current_period_end: null,
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      cancelled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vi.mocked(getPlanByCode).mockResolvedValue({
      id: "plan_1",
      code: "STARTER",
      name: "Starter",
      description: null,
      price: 1499,
      monthly_price: 1499,
      yearly_price: 14990,
      currency: "INR",
      billing_cycle: "MONTHLY",
      features: { reservations: true },
      limits: {
        max_branches: 2,
        max_staff: 10,
        max_tables: 25,
        max_queue_entries_per_month: 1000,
        max_reservations_per_month: 500,
        max_displays: 2,
      },
      is_active: true,
      sort_order: 20,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await processRazorpayWebhook({
      rawBody,
      signature: sign(rawBody),
      eventId: "evt_unknown",
    });

    expect(result.ok).toBe(true);
  });
});
