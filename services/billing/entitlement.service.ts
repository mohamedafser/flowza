import {
  DowngradeBlockedError,
  SubscriptionFeatureError,
  SubscriptionLimitError,
} from "@/lib/billing/errors";
import {
  featureToPlanKey,
  limitForResource,
  usageForResource,
  type DowngradeConflict,
  type EntitlementFeature,
  type PlanLimits,
  type PlanRecord,
  type UsageMeter,
  type UsageResource,
  type UsageSummary,
} from "@/lib/billing/types";
import { getCurrentPlan, getSubscription } from "@/services/billing/subscription.service";
import { getUsageSummary } from "@/services/billing/usage.service";

function planName(plan: PlanRecord | null): string {
  return plan?.name ?? plan?.code ?? "current";
}

export async function checkFeatureAccess(
  restaurantId: string,
  feature: EntitlementFeature,
): Promise<boolean> {
  const plan = await getCurrentPlan(restaurantId);
  if (!plan) return false;

  const featureKey = featureToPlanKey(feature);
  if (!featureKey) {
    // Quantity-based resources are allowed when under limit.
    return true;
  }

  if (feature === "tv_displays" && plan.features.multiple_displays) {
    return true;
  }

  return Boolean(plan.features[featureKey]);
}

export async function assertFeatureAccess(
  restaurantId: string,
  feature: EntitlementFeature,
): Promise<void> {
  const allowed = await checkFeatureAccess(restaurantId, feature);
  if (allowed) return;

  const plan = await getCurrentPlan(restaurantId);
  throw new SubscriptionFeatureError(feature, planName(plan));
}

export async function checkUsageLimit(
  restaurantId: string,
  resource: UsageResource,
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  plan: PlanRecord | null;
}> {
  const plan = await getCurrentPlan(restaurantId);
  const limits = plan?.limits;
  const limit = limits ? limitForResource(limits, resource) : 0;

  const period =
    resource === "queue_entries" || resource === "reservations"
      ? await resolveBillingPeriod(restaurantId)
      : null;

  const usage = await getUsageSummary(
    restaurantId,
    period?.start ?? null,
    period?.end ?? null,
  );
  const current = usageForResource(usage, resource);

  return {
    allowed: current < limit,
    current,
    limit,
    plan,
  };
}

export async function assertUsageLimit(
  restaurantId: string,
  resource: UsageResource,
): Promise<void> {
  const result = await checkUsageLimit(restaurantId, resource);
  if (result.allowed) return;

  throw new SubscriptionLimitError({
    resource,
    currentUsage: result.current,
    limit: result.limit,
    plan: planName(result.plan),
  });
}

export async function canCreateBranch(restaurantId: string): Promise<boolean> {
  return (await checkUsageLimit(restaurantId, "branches")).allowed;
}

export async function canAddStaffMember(
  restaurantId: string,
): Promise<boolean> {
  return (await checkUsageLimit(restaurantId, "staff")).allowed;
}

export async function canCreateTable(restaurantId: string): Promise<boolean> {
  return (await checkUsageLimit(restaurantId, "tables")).allowed;
}

export async function canCreateQueueEntry(
  restaurantId: string,
): Promise<boolean> {
  return (await checkUsageLimit(restaurantId, "queue_entries")).allowed;
}

export async function canCreateReservation(
  restaurantId: string,
): Promise<boolean> {
  const featureOk = await checkFeatureAccess(restaurantId, "reservations");
  if (!featureOk) return false;
  return (await checkUsageLimit(restaurantId, "reservations")).allowed;
}

export async function canCreateDisplay(
  restaurantId: string,
): Promise<boolean> {
  const featureOk = await checkFeatureAccess(restaurantId, "tv_displays");
  if (!featureOk) return false;
  return (await checkUsageLimit(restaurantId, "displays")).allowed;
}

export function buildUsageMeters(
  usage: UsageSummary,
  limits: PlanLimits | null,
): UsageMeter[] {
  const resources: Array<{ resource: UsageResource; label: string }> = [
    { resource: "branches", label: "Branches" },
    { resource: "staff", label: "Staff" },
    { resource: "tables", label: "Tables" },
    { resource: "queue_entries", label: "Queue entries" },
    { resource: "reservations", label: "Reservations" },
    { resource: "displays", label: "Displays" },
  ];

  return resources.map(({ resource, label }) => {
    const limit = limits ? limitForResource(limits, resource) : 0;
    return {
      resource,
      label,
      current: usageForResource(usage, resource),
      limit,
      unlimited: limit < 0,
    };
  });
}

export function findDowngradeConflicts(
  usage: UsageSummary,
  targetLimits: PlanLimits,
): DowngradeConflict[] {
  const resources: UsageResource[] = [
    "branches",
    "staff",
    "tables",
    "displays",
  ];
  const conflicts: DowngradeConflict[] = [];

  for (const resource of resources) {
    const currentUsage = usageForResource(usage, resource);
    const limit = limitForResource(targetLimits, resource);
    if (currentUsage > limit) {
      conflicts.push({ resource, currentUsage, limit });
    }
  }

  return conflicts;
}

export async function assertDowngradeAllowed(
  restaurantId: string,
  targetPlan: PlanRecord,
): Promise<void> {
  const usage = await getUsageSummary(restaurantId);
  const conflicts = findDowngradeConflicts(usage, targetPlan.limits);
  if (conflicts.length > 0) {
    throw new DowngradeBlockedError(targetPlan.name, conflicts);
  }
}

async function resolveBillingPeriod(
  restaurantId: string,
): Promise<{ start: string; end: string } | null> {
  const subscription = await getSubscription(restaurantId);
  if (subscription?.current_period_start && subscription.current_period_end) {
    return {
      start: subscription.current_period_start,
      end: subscription.current_period_end,
    };
  }

  const now = new Date();
  return {
    start: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString(),
    end: now.toISOString(),
  };
}
