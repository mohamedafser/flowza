import type {
  DowngradeConflict,
  SubscriptionLimitErrorPayload,
  UsageResource,
} from "@/lib/billing/types";

export class SubscriptionLimitError extends Error {
  readonly code = "SUBSCRIPTION_LIMIT_REACHED" as const;
  readonly resource: UsageResource;
  readonly currentUsage: number;
  readonly limit: number;
  readonly plan: string;

  constructor(input: Omit<SubscriptionLimitErrorPayload, "code">) {
    super(formatLimitMessage(input.resource, input.plan));
    this.name = "SubscriptionLimitError";
    this.resource = input.resource;
    this.currentUsage = input.currentUsage;
    this.limit = input.limit;
    this.plan = input.plan;
  }

  toJSON(): SubscriptionLimitErrorPayload {
    return {
      code: this.code,
      resource: this.resource,
      currentUsage: this.currentUsage,
      limit: this.limit,
      plan: this.plan,
    };
  }
}

export class SubscriptionFeatureError extends Error {
  readonly code = "SUBSCRIPTION_FEATURE_BLOCKED" as const;
  readonly feature: string;
  readonly plan: string;

  constructor(feature: string, plan: string) {
    super(
      `The ${plan} plan does not include ${featureLabel(feature)}. Upgrade to unlock this feature.`,
    );
    this.name = "SubscriptionFeatureError";
    this.feature = feature;
    this.plan = plan;
  }
}

export class DowngradeBlockedError extends Error {
  readonly code = "SUBSCRIPTION_DOWNGRADE_BLOCKED" as const;
  readonly conflicts: DowngradeConflict[];
  readonly targetPlan: string;

  constructor(targetPlan: string, conflicts: DowngradeConflict[]) {
    super(formatDowngradeMessage(targetPlan, conflicts));
    this.name = "DowngradeBlockedError";
    this.targetPlan = targetPlan;
    this.conflicts = conflicts;
  }
}

export class BillingProviderError extends Error {
  readonly code = "BILLING_PROVIDER_ERROR" as const;

  constructor(message = "Unable to complete billing request. Please try again.") {
    super(message);
    this.name = "BillingProviderError";
  }
}

function resourceLabel(resource: UsageResource): { singular: string; plural: string } {
  switch (resource) {
    case "branches":
      return { singular: "branch", plural: "branches" };
    case "staff":
      return { singular: "staff member", plural: "staff members" };
    case "tables":
      return { singular: "table", plural: "tables" };
    case "queue_entries":
      return { singular: "queue entry", plural: "queue entries" };
    case "reservations":
      return { singular: "reservation", plural: "reservations" };
    case "displays":
      return { singular: "display", plural: "displays" };
  }
}

function featureLabel(feature: string): string {
  return feature.replace(/_/g, " ");
}

export function formatLimitMessage(
  resource: UsageResource,
  plan: string,
): string {
  const { singular, plural } = resourceLabel(resource);
  return `You've reached your ${plural} limit for the ${plan} plan. Upgrade your plan to add another ${singular}.`;
}

export function formatDowngradeMessage(
  targetPlan: string,
  conflicts: DowngradeConflict[],
): string {
  if (conflicts.length === 0) {
    return `Unable to switch to the ${targetPlan} plan with your current usage.`;
  }
  const first = conflicts[0]!;
  const { plural } = resourceLabel(first.resource);
  return `Your current plan uses ${first.currentUsage} ${plural}. The ${targetPlan} plan supports only ${first.limit}. Please reduce your active ${plural} before downgrading.`;
}

export function isSubscriptionLimitError(
  error: unknown,
): error is SubscriptionLimitError {
  return error instanceof SubscriptionLimitError;
}

export function isDowngradeBlockedError(
  error: unknown,
): error is DowngradeBlockedError {
  return error instanceof DowngradeBlockedError;
}
