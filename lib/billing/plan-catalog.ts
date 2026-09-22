/**
 * Marketing / default plan catalog.
 * Keep in sync with seeded rows in subscription_billing migration.
 * UI must not hard-code prices outside this module.
 */
export type MarketingPlan = {
  code: "FREE" | "STARTER" | "BUSINESS";
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: "INR";
  highlighted?: boolean;
  limits: {
    branches: number;
    staff: number;
    tables: number;
    queueEntriesPerMonth: number;
  };
  features: string[];
};

export const MARKETING_PLANS: readonly MarketingPlan[] = [
  {
    code: "FREE",
    name: "Free",
    description: "Essential queue tools for a single location.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    limits: {
      branches: 1,
      staff: 2,
      tables: 2,
      queueEntriesPerMonth: 100,
    },
    features: [
      "Basic queue management",
      "Basic customer records",
      "Basic dashboard",
    ],
  },
  {
    code: "STARTER",
    name: "Starter",
    description:
      "Reservations, displays, notifications, and analytics for growing teams.",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    currency: "INR",
    highlighted: true,
    limits: {
      branches: 2,
      staff: 10,
      tables: 25,
      queueEntriesPerMonth: 1000,
    },
    features: [
      "Reservations & walk-ins",
      "TV lobby displays",
      "Guest notifications",
      "Analytics & exports",
    ],
  },
  {
    code: "BUSINESS",
    name: "Business",
    description: "Higher limits, advanced analytics, and multiple TV displays.",
    monthlyPrice: 3999,
    yearlyPrice: 39990,
    currency: "INR",
    limits: {
      branches: 5,
      staff: 30,
      tables: 100,
      queueEntriesPerMonth: 5000,
    },
    features: [
      "Everything in Starter",
      "Advanced analytics",
      "Multiple displays",
      "Higher monthly capacity",
    ],
  },
] as const;

export function formatPlanPrice(
  amount: number,
  currency: string,
  cycle: "month" | "year",
): string {
  if (amount <= 0) {
    return "₹0";
  }
  try {
    const formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
    return `${formatted}/${cycle === "year" ? "yr" : "mo"}`;
  } catch {
    return `${currency} ${amount}/${cycle === "year" ? "yr" : "mo"}`;
  }
}
