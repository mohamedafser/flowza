import { describe, expect, it } from "vitest";
import {
  formatPlanPrice,
  MARKETING_PLANS,
} from "@/lib/billing/plan-catalog";

describe("marketing plan catalog", () => {
  it("exposes Free, Starter, and Business with catalog prices", () => {
    expect(MARKETING_PLANS.map((plan) => plan.code)).toEqual([
      "FREE",
      "STARTER",
      "BUSINESS",
    ]);
    expect(MARKETING_PLANS[0]?.monthlyPrice).toBe(0);
    expect(MARKETING_PLANS[1]?.monthlyPrice).toBe(1499);
    expect(MARKETING_PLANS[2]?.yearlyPrice).toBe(39990);
  });

  it("formats paid prices without inventing discounts", () => {
    expect(formatPlanPrice(1499, "INR", "month")).toContain("1,499");
    expect(formatPlanPrice(0, "INR", "month")).toBe("₹0");
  });
});
