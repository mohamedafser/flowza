import type { Enums, Json, Tables } from "@/types/database";

export type BillingCycle = Enums<"billing_cycle">;
export type SubscriptionStatus = Enums<"subscription_status">;
export type PaymentStatus = Enums<"payment_status">;

export type BillingProviderName = "RAZORPAY" | "NONE";

export type PlanFeatureKey =
  | "basic_queue"
  | "basic_customers"
  | "basic_dashboard"
  | "reservations"
  | "notifications"
  | "tv_displays"
  | "analytics"
  | "advanced_analytics"
  | "exports"
  | "multiple_displays";

export type EntitlementFeature =
  | "branches"
  | "staff"
  | "tables"
  | "queue_entries"
  | "reservations"
  | "notifications"
  | "tv_displays"
  | "analytics"
  | "advanced_analytics"
  | "exports";

export type UsageResource =
  | "branches"
  | "staff"
  | "tables"
  | "queue_entries"
  | "reservations"
  | "displays";

export type PlanLimits = {
  max_branches: number;
  max_staff: number;
  max_tables: number;
  max_queue_entries_per_month: number;
  max_reservations_per_month: number;
  max_displays: number;
};

export type PlanFeatures = Partial<Record<PlanFeatureKey, boolean>>;

export type PlanRecord = Tables<"plans"> & {
  code: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  limits: PlanLimits;
  features: PlanFeatures;
};

export type SubscriptionRecord = Tables<"subscriptions">;

export type PaymentRecord = Tables<"payments">;

export type UsageSummary = {
  branches: number;
  staff: number;
  tables: number;
  queue_entries: number;
  reservations: number;
  displays: number;
  period_start: string;
  period_end: string;
};

export type UsageMeter = {
  resource: UsageResource;
  label: string;
  current: number;
  limit: number | null;
  unlimited: boolean;
};

export type SubscriptionLimitErrorPayload = {
  code: "SUBSCRIPTION_LIMIT_REACHED";
  resource: UsageResource;
  currentUsage: number;
  limit: number;
  plan: string;
};

export type DowngradeConflict = {
  resource: UsageResource;
  currentUsage: number;
  limit: number;
};

export type BillingOverview = {
  subscription: SubscriptionRecord | null;
  plan: PlanRecord | null;
  plans: PlanRecord[];
  usage: UsageSummary;
  meters: UsageMeter[];
  payments: PaymentRecord[];
  status: SubscriptionStatus | "NONE";
  isActive: boolean;
  isExpired: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  cancelAtPeriodEnd: boolean;
  currentPrice: number | null;
  currency: string;
  providerConfigured: boolean;
  publicKey: string | null;
};

export type CheckoutSession = {
  subscriptionId: string;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  keyId: string;
  amount: number;
  currency: string;
  planCode: string;
  billingCycle: BillingCycle;
  name: string;
  description: string;
  notes: Record<string, string>;
};

export type VerifyCheckoutInput = {
  restaurantId: string;
  planCode: string;
  billingCycle: BillingCycle;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
};

export function parsePlanLimits(value: Json | null | undefined): PlanLimits {
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const num = (key: keyof PlanLimits, fallback: number) => {
    const raw = obj[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  };

  return {
    max_branches: num("max_branches", 1),
    max_staff: num("max_staff", 2),
    max_tables: num("max_tables", 2),
    max_queue_entries_per_month: num("max_queue_entries_per_month", 100),
    max_reservations_per_month: num("max_reservations_per_month", 0),
    max_displays: num("max_displays", 0),
  };
}

export function parsePlanFeatures(
  value: Json | null | undefined,
): PlanFeatures {
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const features: PlanFeatures = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (typeof raw === "boolean") {
      features[key as PlanFeatureKey] = raw;
    }
  }
  return features;
}

export function limitForResource(
  limits: PlanLimits,
  resource: UsageResource,
): number {
  switch (resource) {
    case "branches":
      return limits.max_branches;
    case "staff":
      return limits.max_staff;
    case "tables":
      return limits.max_tables;
    case "queue_entries":
      return limits.max_queue_entries_per_month;
    case "reservations":
      return limits.max_reservations_per_month;
    case "displays":
      return limits.max_displays;
  }
}

export function usageForResource(
  usage: UsageSummary,
  resource: UsageResource,
): number {
  return usage[resource];
}

export function featureToPlanKey(
  feature: EntitlementFeature,
): PlanFeatureKey | null {
  switch (feature) {
    case "reservations":
      return "reservations";
    case "notifications":
      return "notifications";
    case "tv_displays":
      return "tv_displays";
    case "analytics":
      return "analytics";
    case "advanced_analytics":
      return "advanced_analytics";
    case "exports":
      return "exports";
    case "branches":
    case "staff":
    case "tables":
    case "queue_entries":
      return null;
  }
}
