import type { Enums, Tables } from "@/types/database";
import type { PlanRecord } from "@/lib/billing/types";
import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import type {
  adminChangePlanSchema,
  adminExtendTrialSchema,
  adminSubscriptionListSchema,
} from "@/lib/validations/admin";
import {
  buildPageResult,
  emptyPage,
  escapeIlike,
  requireAdminClient,
  type PageResult,
} from "@/services/admin/admin-client";
import { writePlatformAuditLog } from "@/services/audit";
import { getBillingProvider } from "@/services/billing/providers";
import {
  getPlanById,
  planPrice,
} from "@/services/billing/plans";
import { upsertSubscriptionAdmin } from "@/services/billing/subscription.service";
import type { z } from "zod";

export type AdminSubscriptionListQuery = z.infer<
  typeof adminSubscriptionListSchema
>;

export type AdminSubscriptionListItem = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  planCode: string | null;
  status: Enums<"subscription_status">;
  billingCycle: Enums<"billing_cycle">;
  amount: number | null;
  currency: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};

export type AdminSubscriptionDetail = {
  subscription: Tables<"subscriptions">;
  restaurant: Pick<Tables<"restaurants">, "id" | "name" | "status" | "slug">;
  plan: PlanRecord | null;
  payments: Tables<"payments">[];
};

export async function listAdminSubscriptions(
  query: AdminSubscriptionListQuery,
): Promise<PageResult<AdminSubscriptionListItem>> {
  await requirePlatformPermission("platform.subscriptions.view");
  const admin = requireAdminClient();
  const { page, pageSize } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let subQuery = admin
    .from("subscriptions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.status !== "ALL") {
    subQuery = subQuery.eq("status", query.status);
  }
  if (query.billingCycle !== "ALL") {
    subQuery = subQuery.eq("billing_cycle", query.billingCycle);
  }
  if (query.plan) {
    subQuery = subQuery.eq("plan", query.plan.toUpperCase());
  }
  if (query.createdFrom) {
    subQuery = subQuery.gte("created_at", query.createdFrom);
  }
  if (query.createdTo) {
    subQuery = subQuery.lte("created_at", query.createdTo);
  }

  const search = query.q?.trim();
  if (search) {
    const like = `%${escapeIlike(search)}%`;
    const { data: restaurants } = await admin
      .from("restaurants")
      .select("id")
      .ilike("name", like);
    const ids = (restaurants ?? []).map((r) => r.id);
    if (ids.length === 0) return emptyPage(page, pageSize);
    subQuery = subQuery.in("restaurant_id", ids);
  }

  const { data: rows, count, error } = await subQuery;
  if (error || !rows) return emptyPage(page, pageSize);

  const restaurantIds = [...new Set(rows.map((r) => r.restaurant_id))];
  const planIds = [
    ...new Set(rows.map((r) => r.plan_id).filter(Boolean) as string[]),
  ];

  const [{ data: restaurants }, { data: plans }] = await Promise.all([
    restaurantIds.length
      ? admin.from("restaurants").select("id, name").in("id", restaurantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    planIds.length
      ? admin
          .from("plans")
          .select("id, code, monthly_price, yearly_price, currency")
          .in("id", planIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            code: string;
            monthly_price: number;
            yearly_price: number;
            currency: string;
          }>,
        }),
  ]);

  const restaurantName = new Map(
    (restaurants ?? []).map((r) => [r.id, r.name] as const),
  );
  const planById = new Map((plans ?? []).map((p) => [p.id, p] as const));

  const items: AdminSubscriptionListItem[] = rows.map((row) => {
    const plan = row.plan_id ? planById.get(row.plan_id) : null;
    const amount = plan
      ? row.billing_cycle === "YEARLY"
        ? Number(plan.yearly_price)
        : Number(plan.monthly_price)
      : null;
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      restaurantName: restaurantName.get(row.restaurant_id) ?? "Unknown",
      planCode: row.plan ?? plan?.code ?? null,
      status: row.status,
      billingCycle: row.billing_cycle,
      amount,
      currency: plan?.currency ?? null,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      trialEnd: row.trial_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: row.created_at,
    };
  });

  return buildPageResult(items, count ?? items.length, page, pageSize);
}

export async function getAdminSubscriptionDetail(
  subscriptionId: string,
): Promise<AdminSubscriptionDetail | null> {
  await requirePlatformPermission("platform.subscriptions.view");
  const admin = requireAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription) return null;

  const [{ data: restaurant }, plan, { data: payments }] = await Promise.all([
    admin
      .from("restaurants")
      .select("id, name, status, slug")
      .eq("id", subscription.restaurant_id)
      .maybeSingle(),
    subscription.plan_id
      ? getPlanById(subscription.plan_id)
      : Promise.resolve(null),
    admin
      .from("payments")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!restaurant) return null;

  return {
    subscription,
    restaurant,
    plan,
    payments: payments ?? [],
  };
}

export async function adminCancelSubscription(
  subscriptionId: string,
): Promise<Tables<"subscriptions">> {
  const context = await requirePlatformPermission(
    "platform.subscriptions.manage",
  );
  const detail = await getAdminSubscriptionDetail(subscriptionId);
  if (!detail) throw new Error("Subscription not found.");

  const { subscription, plan } = detail;
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

  if (!plan) throw new Error("Plan not found for subscription.");

  const updated = await upsertSubscriptionAdmin({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
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

  await writePlatformAuditLog({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    userId: context.user.id,
    action: "SUBSCRIPTION_CANCELLED",
    entityType: "subscription",
    entityId: updated.id,
    metadata: { cancelAtPeriodEnd: true },
  });

  return updated;
}

export async function adminReactivateSubscription(
  subscriptionId: string,
): Promise<Tables<"subscriptions">> {
  const context = await requirePlatformPermission(
    "platform.subscriptions.manage",
  );
  const detail = await getAdminSubscriptionDetail(subscriptionId);
  if (!detail) throw new Error("Subscription not found.");

  const { subscription, plan } = detail;
  if (!subscription.cancel_at_period_end && subscription.status !== "CANCELLED") {
    throw new Error("Subscription is not scheduled for cancellation.");
  }

  const provider = getBillingProvider();
  if (
    subscription.provider_subscription_id &&
    provider.isConfigured() &&
    subscription.provider === provider.name
  ) {
    await provider.resumeSubscription(subscription.provider_subscription_id);
  }

  if (!plan) throw new Error("Plan not found for subscription.");

  const updated = await upsertSubscriptionAdmin({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    plan,
    billingCycle: subscription.billing_cycle,
    status:
      subscription.status === "CANCELLED" ? "ACTIVE" : subscription.status,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    provider: subscription.provider,
    providerCustomerId: subscription.provider_customer_id,
    providerSubscriptionId: subscription.provider_subscription_id,
  });

  await writePlatformAuditLog({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    userId: context.user.id,
    action: "SUBSCRIPTION_REACTIVATED",
    entityType: "subscription",
    entityId: updated.id,
    metadata: { plan: plan.code },
  });

  return updated;
}

export async function adminChangeSubscriptionPlan(
  subscriptionId: string,
  input: z.infer<typeof adminChangePlanSchema>,
): Promise<Tables<"subscriptions">> {
  const context = await requirePlatformPermission(
    "platform.subscriptions.manage",
  );
  const detail = await getAdminSubscriptionDetail(subscriptionId);
  if (!detail) throw new Error("Subscription not found.");

  const plan = await getPlanById(input.planId);
  if (!plan || !plan.is_active) {
    throw new Error("Plan is not available.");
  }

  const { subscription } = detail;
  const billingCycle = input.billingCycle ?? subscription.billing_cycle;

  const updated = await upsertSubscriptionAdmin({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    plan,
    billingCycle,
    status:
      subscription.status === "CANCELLED" || subscription.status === "EXPIRED"
        ? "ACTIVE"
        : subscription.status,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    trialStart: subscription.trial_start,
    trialEnd: subscription.trial_end,
    provider: subscription.provider,
    providerCustomerId: subscription.provider_customer_id,
    providerSubscriptionId: subscription.provider_subscription_id,
  });

  await writePlatformAuditLog({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    userId: context.user.id,
    action: "SUBSCRIPTION_UPDATED",
    entityType: "subscription",
    entityId: updated.id,
    metadata: {
      plan: plan.code,
      billingCycle,
      amount: planPrice(plan, billingCycle),
    },
  });

  return updated;
}

export async function adminExtendTrial(
  subscriptionId: string,
  input: z.infer<typeof adminExtendTrialSchema>,
): Promise<Tables<"subscriptions">> {
  const context = await requirePlatformPermission(
    "platform.subscriptions.manage",
  );
  const detail = await getAdminSubscriptionDetail(subscriptionId);
  if (!detail?.plan) throw new Error("Subscription not found.");

  const { subscription, plan } = detail;
  const base = subscription.trial_end
    ? new Date(subscription.trial_end)
    : new Date();
  if (base.getTime() < Date.now()) {
    base.setTime(Date.now());
  }
  base.setUTCDate(base.getUTCDate() + input.days);
  const trialEnd = base.toISOString();

  const updated = await upsertSubscriptionAdmin({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    plan,
    billingCycle: subscription.billing_cycle,
    status: "TRIALING",
    trialStart: subscription.trial_start ?? new Date().toISOString(),
    trialEnd,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: trialEnd,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    provider: subscription.provider,
    providerCustomerId: subscription.provider_customer_id,
    providerSubscriptionId: subscription.provider_subscription_id,
  });

  await writePlatformAuditLog({
    restaurantId: subscription.restaurant_id,
    organizationId: subscription.organization_id,
    userId: context.user.id,
    action: "TRIAL_EXTENDED",
    entityType: "subscription",
    entityId: updated.id,
    metadata: { days: input.days, trialEnd },
  });

  return updated;
}
