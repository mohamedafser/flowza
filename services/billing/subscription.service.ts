import { requirePermission } from "@/lib/auth/guards";
import { isEntitlementActive } from "@/lib/billing/status";
import type {
  BillingCycle,
  PlanRecord,
  SubscriptionRecord,
  SubscriptionStatus,
} from "@/lib/billing/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPlanByCode, getPlanById, isFreePlan } from "@/services/billing/plans";

export async function getSubscription(
  restaurantId: string,
): Promise<SubscriptionRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getSubscriptionAdmin(
  restaurantId: string,
): Promise<SubscriptionRecord | null> {
  const admin = createServiceRoleClient();
  if (!admin) return getSubscription(restaurantId);

  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getSubscriptionByProviderId(
  provider: string,
  providerSubscriptionId: string,
): Promise<SubscriptionRecord | null> {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());

  const { data, error } = await client
    .from("subscriptions")
    .select("*")
    .eq("provider", provider)
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getCurrentPlan(
  restaurantId: string,
): Promise<PlanRecord | null> {
  const subscription = await getSubscription(restaurantId);
  if (!subscription) {
    return getPlanByCode("FREE");
  }

  if (subscription.plan_id) {
    const byId = await getPlanById(subscription.plan_id);
    if (byId) return byId;
  }

  if (subscription.plan) {
    const byCode = await getPlanByCode(subscription.plan);
    if (byCode) return byCode;
  }

  return getPlanByCode("FREE");
}

export async function getSubscriptionStatus(
  restaurantId: string,
): Promise<SubscriptionStatus | "NONE"> {
  const subscription = await getSubscription(restaurantId);
  if (!subscription) return "NONE";
  return subscription.status;
}

export async function getPlanLimits(restaurantId: string) {
  const plan = await getCurrentPlan(restaurantId);
  return plan?.limits ?? null;
}

export async function hasActiveSubscription(
  restaurantId: string,
): Promise<boolean> {
  const status = await getSubscriptionStatus(restaurantId);
  return isEntitlementActive(status);
}

export async function isSubscriptionExpired(
  restaurantId: string,
): Promise<boolean> {
  const subscription = await getSubscription(restaurantId);
  if (!subscription) return false;

  if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
    return true;
  }

  if (
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() < Date.now() &&
    subscription.cancel_at_period_end
  ) {
    return true;
  }

  if (
    subscription.status === "TRIALING" &&
    subscription.trial_end &&
    new Date(subscription.trial_end).getTime() < Date.now()
  ) {
    return true;
  }

  return false;
}

export function trialDaysRemaining(
  subscription: SubscriptionRecord | null,
  now = new Date(),
): number | null {
  if (!subscription?.trial_end || subscription.status !== "TRIALING") {
    return null;
  }
  const end = new Date(subscription.trial_end).getTime();
  const ms = end - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function ensureRestaurantSubscription(
  restaurantId: string,
  organizationId: string,
): Promise<SubscriptionRecord> {
  const existing = await getSubscription(restaurantId);
  if (existing) return existing;

  const free = await getPlanByCode("FREE");
  const supabase = await createClient();
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      restaurant_id: restaurantId,
      organization_id: organizationId,
      plan_id: free?.id ?? null,
      plan: free?.code ?? "FREE",
      status: "TRIALING",
      billing_cycle: "MONTHLY",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd,
      trial_start: new Date().toISOString(),
      trial_end: trialEnd,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    const again = await getSubscription(restaurantId);
    if (again) return again;
    throw new Error("Unable to provision subscription.");
  }

  return data;
}

export type UpdateSubscriptionInput = {
  restaurantId: string;
  organizationId: string;
  plan: PlanRecord;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  provider?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
};

export async function upsertSubscriptionAdmin(
  input: UpdateSubscriptionInput,
): Promise<SubscriptionRecord> {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());
  const existing = admin
    ? await getSubscriptionAdmin(input.restaurantId)
    : await getSubscription(input.restaurantId);

  const payload = {
    restaurant_id: input.restaurantId,
    organization_id: input.organizationId,
    plan_id: input.plan.id,
    plan: input.plan.code,
    status: input.status,
    billing_cycle: input.billingCycle,
    provider: input.provider ?? existing?.provider ?? null,
    provider_customer_id:
      input.providerCustomerId ?? existing?.provider_customer_id ?? null,
    provider_subscription_id:
      input.providerSubscriptionId ??
      existing?.provider_subscription_id ??
      null,
    current_period_start:
      input.currentPeriodStart ?? existing?.current_period_start ?? null,
    current_period_end:
      input.currentPeriodEnd ?? existing?.current_period_end ?? null,
    trial_start: input.trialStart ?? existing?.trial_start ?? null,
    trial_end: input.trialEnd ?? existing?.trial_end ?? null,
    cancel_at_period_end:
      input.cancelAtPeriodEnd ?? existing?.cancel_at_period_end ?? false,
    cancelled_at: input.cancelledAt ?? existing?.cancelled_at ?? null,
  };

  if (existing) {
    const { data, error } = await client
      .from("subscriptions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      throw new Error("Unable to update subscription.");
    }

    await client
      .from("organizations")
      .update({ plan_id: input.plan.id })
      .eq("id", input.organizationId);

    return data;
  }

  const { data, error } = await client
    .from("subscriptions")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to create subscription.");
  }

  await client
    .from("organizations")
    .update({ plan_id: input.plan.id })
    .eq("id", input.organizationId);

  return data;
}

export async function requireBillingView(restaurantId: string) {
  return requirePermission(restaurantId, "billing.view");
}

export async function requireBillingManage(restaurantId: string) {
  return requirePermission(restaurantId, "billing.manage");
}

export { isFreePlan };
