import type { Enums, Tables } from "@/types/database";
import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import type {
  adminPaymentListSchema,
  adminRevenueRangeSchema,
} from "@/lib/validations/admin";
import {
  buildPageResult,
  emptyPage,
  escapeIlike,
  requireAdminClient,
  type PageResult,
} from "@/services/admin/admin-client";
import type { z } from "zod";

export type AdminPaymentListQuery = z.infer<typeof adminPaymentListSchema>;
export type AdminRevenueRangeQuery = z.infer<typeof adminRevenueRangeSchema>;

export type AdminPaymentListItem = {
  id: string;
  createdAt: string;
  paidAt: string | null;
  restaurantId: string;
  restaurantName: string;
  amount: number;
  currency: string;
  status: Enums<"payment_status">;
  provider: string | null;
  providerPaymentId: string | null;
};

export type AdminRevenueAnalytics = {
  range: AdminRevenueRangeQuery["range"];
  from: string;
  to: string;
  revenue: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  currency: string;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  cancellations: number;
};

function resolveRange(query: AdminRevenueRangeQuery): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const endOfDay = (d: Date) => {
    const s = startOfDay(d);
    s.setUTCDate(s.getUTCDate() + 1);
    return s;
  };

  switch (query.range) {
    case "today": {
      const from = startOfDay(now);
      return { from, to: endOfDay(now) };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setUTCDate(y.getUTCDate() - 1);
      return { from: startOfDay(y), to: startOfDay(now) };
    }
    case "last_7_days": {
      const from = startOfDay(now);
      from.setUTCDate(from.getUTCDate() - 6);
      return { from, to: endOfDay(now) };
    }
    case "last_30_days": {
      const from = startOfDay(now);
      from.setUTCDate(from.getUTCDate() - 29);
      return { from, to: endOfDay(now) };
    }
    case "this_month": {
      const from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      return { from, to: endOfDay(now) };
    }
    case "last_month": {
      const from = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const to = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      return { from, to };
    }
    case "custom": {
      if (!query.from || !query.to) {
        throw new Error("Custom range requires from and to dates.");
      }
      return { from: new Date(query.from), to: new Date(query.to) };
    }
    default:
      return resolveRange({ range: "last_30_days" });
  }
}

export async function listAdminPayments(
  query: AdminPaymentListQuery,
): Promise<PageResult<AdminPaymentListItem>> {
  await requirePlatformPermission("platform.payments.view");
  const admin = requireAdminClient();
  const { page, pageSize } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let paymentQuery = admin
    .from("payments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.status !== "ALL") {
    paymentQuery = paymentQuery.eq("status", query.status);
  }
  if (query.restaurantId) {
    paymentQuery = paymentQuery.eq("restaurant_id", query.restaurantId);
  }
  if (query.provider) {
    paymentQuery = paymentQuery.eq("provider", query.provider);
  }
  if (query.from) {
    paymentQuery = paymentQuery.gte("created_at", query.from);
  }
  if (query.to) {
    paymentQuery = paymentQuery.lte("created_at", query.to);
  }

  const search = query.q?.trim();
  if (search) {
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        search,
      )
    ) {
      paymentQuery = paymentQuery.or(
        `id.eq.${search},provider_payment_id.eq.${search},restaurant_id.eq.${search}`,
      );
    } else {
      const like = `%${escapeIlike(search)}%`;
      const { data: restaurants } = await admin
        .from("restaurants")
        .select("id")
        .ilike("name", like);
      const ids = (restaurants ?? []).map((r) => r.id);
      if (ids.length === 0) {
        paymentQuery = paymentQuery.ilike("provider_payment_id", like);
      } else {
        paymentQuery = paymentQuery.or(
          `restaurant_id.in.(${ids.join(",")}),provider_payment_id.ilike.${like}`,
        );
      }
    }
  }

  const { data: rows, count, error } = await paymentQuery;
  if (error || !rows) return emptyPage(page, pageSize);

  const restaurantIds = [...new Set(rows.map((r) => r.restaurant_id))];
  const { data: restaurants } = restaurantIds.length
    ? await admin.from("restaurants").select("id, name").in("id", restaurantIds)
    : { data: [] as { id: string; name: string }[] };

  const nameById = new Map((restaurants ?? []).map((r) => [r.id, r.name]));

  const items: AdminPaymentListItem[] = rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    restaurantId: row.restaurant_id,
    restaurantName: nameById.get(row.restaurant_id) ?? "Unknown",
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
  }));

  return buildPageResult(items, count ?? items.length, page, pageSize);
}

export async function getAdminRevenueAnalytics(
  query: AdminRevenueRangeQuery,
): Promise<AdminRevenueAnalytics> {
  await requirePlatformPermission("platform.payments.view");
  const admin = requireAdminClient();
  const { from, to } = resolveRange(query);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [
    successPayments,
    failedCount,
    pendingCount,
    refundedCount,
    activeSubs,
    trialingSubs,
    cancelledSubs,
  ] = await Promise.all([
    admin
      .from("payments")
      .select("amount, currency")
      .eq("status", "SUCCESS")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "FAILED")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "REFUNDED")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "TRIALING"),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "CANCELLED")
      .gte("cancelled_at", fromIso)
      .lt("cancelled_at", toIso),
  ]);

  const revenue = (successPayments.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );

  return {
    range: query.range,
    from: fromIso,
    to: toIso,
    revenue,
    successfulPayments: successPayments.data?.length ?? 0,
    failedPayments: failedCount.count ?? 0,
    pendingPayments: pendingCount.count ?? 0,
    refundedPayments: refundedCount.count ?? 0,
    currency: successPayments.data?.[0]?.currency ?? "INR",
    activeSubscriptions: activeSubs.count ?? 0,
    trialingSubscriptions: trialingSubs.count ?? 0,
    cancellations: cancelledSubs.count ?? 0,
  };
}

export type { Tables };
