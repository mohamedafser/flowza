import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutSchema, verifyCheckoutSchema } from "@/lib/validations/billing";
import { isPublicAuthAssetPath } from "@/lib/auth/paths";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

describe("billing validation", () => {
  it("accepts valid checkout payloads", () => {
    const parsed = checkoutSchema.safeParse({
      restaurantId: "11111111-1111-4111-8111-111111111111",
      planCode: "STARTER",
      billingCycle: "YEARLY",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid plans and cycles", () => {
    expect(
      checkoutSchema.safeParse({
        restaurantId: "not-a-uuid",
        planCode: "STARTER",
        billingCycle: "WEEKLY",
      }).success,
    ).toBe(false);
  });

  it("requires payment verification fields", () => {
    const parsed = verifyCheckoutSchema.safeParse({
      restaurantId: "11111111-1111-4111-8111-111111111111",
      planCode: "BUSINESS",
      billingCycle: "MONTHLY",
      razorpayPaymentId: "pay_1",
      razorpaySubscriptionId: "sub_1",
      razorpaySignature: "sig",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("billing migration safety", () => {
  it("extends plans/subscriptions and adds webhook_events without drops", () => {
    const file = readdirSync(migrationsDir).find((f) =>
      f.includes("subscription_billing"),
    );
    expect(file).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, file!), "utf8");
    expect(sql).toContain("CREATE TABLE public.webhook_events");
    expect(sql).toContain("UNIQUE (provider, event_id)");
    expect(sql).toContain("billing_usage_summary");
    expect(sql).toContain("monthly_price");
    expect(sql).toContain("yearly_price");
    expect(sql).toContain("cancel_at_period_end");
    expect(sql).not.toMatch(/DROP TABLE public\.(plans|subscriptions|payments)/i);
  });
});

describe("webhook route publicity", () => {
  it("allows razorpay webhook path without session auth", () => {
    expect(isPublicAuthAssetPath("/api/webhooks/razorpay")).toBe(true);
  });
});
