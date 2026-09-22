import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import { requireAdminClient } from "@/services/admin/admin-client";

export type AdminDashboardMetrics = {
  restaurants: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    createdLast7Days: number;
    createdLast30Days: number;
  };
  users: {
    total: number;
    active: number;
    disabled: number;
    verified: number;
  };
  subscriptions: {
    active: number;
    trialing: number;
    pastDue: number;
    cancelled: number;
    expired: number;
  };
  revenue: {
    currentPeriodAmount: number;
    previousPeriodAmount: number;
    successfulPayments: number;
    failedPayments: number;
    currency: string;
  };
};

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function monthsAgoUtc(months: number, from = new Date()): Date {
  const d = startOfUtcDay(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  await requirePlatformPermission("platform.dashboard.view");
  const admin = requireAdminClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const currentPeriodStart = monthsAgoUtc(0);
  const previousPeriodStart = monthsAgoUtc(1);
  const previousPeriodEnd = currentPeriodStart;

  const [
    restaurantsTotal,
    restaurantsActive,
    restaurantsInactive,
    restaurantsSuspended,
    restaurants7d,
    restaurants30d,
    usersTotal,
    usersActive,
    usersDisabled,
    subscriptions,
    paymentsSuccessCurrent,
    paymentsSuccessPrevious,
    paymentsSuccessCount,
    paymentsFailedCount,
  ] = await Promise.all([
    admin.from("restaurants").select("id", { count: "exact", head: true }),
    admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("status", "INACTIVE"),
    admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("status", "SUSPENDED"),
    admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
    admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString()),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_status", "ACTIVE"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_status", "DISABLED"),
    admin.from("subscriptions").select("status"),
    admin
      .from("payments")
      .select("amount, currency")
      .eq("status", "SUCCESS")
      .gte("created_at", currentPeriodStart.toISOString()),
    admin
      .from("payments")
      .select("amount")
      .eq("status", "SUCCESS")
      .gte("created_at", previousPeriodStart.toISOString())
      .lt("created_at", previousPeriodEnd.toISOString()),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "SUCCESS")
      .gte("created_at", currentPeriodStart.toISOString()),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "FAILED")
      .gte("created_at", currentPeriodStart.toISOString()),
  ]);

  const statusCounts = {
    active: 0,
    trialing: 0,
    pastDue: 0,
    cancelled: 0,
    expired: 0,
  };
  for (const row of subscriptions.data ?? []) {
    switch (row.status) {
      case "ACTIVE":
        statusCounts.active += 1;
        break;
      case "TRIALING":
        statusCounts.trialing += 1;
        break;
      case "PAST_DUE":
        statusCounts.pastDue += 1;
        break;
      case "CANCELLED":
        statusCounts.cancelled += 1;
        break;
      case "EXPIRED":
        statusCounts.expired += 1;
        break;
      default:
        break;
    }
  }

  const sumAmount = (rows: { amount: number }[] | null | undefined) =>
    (rows ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const currency =
    paymentsSuccessCurrent.data?.[0]?.currency?.toUpperCase() ?? "INR";

  // Verified users require auth.admin listing; approximate via email_confirmed
  // is not on profiles. Report active accounts as a safe proxy, and leave
  // verified as 0 when auth admin is unavailable.
  let verified = 0;
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    // Prefer exact when cheap; otherwise approximate from first page total.
    verified = data.users.filter((u) => Boolean(u.email_confirmed_at)).length;
    // listUsers doesn't return a global verified count; use profiles total as ceiling.
    // For dashboard, count confirmed via paginated scan capped for performance.
    const perPage = 200;
    let page = 1;
    let confirmed = 0;
    let fetched = 0;
    const maxScan = 2000;
    while (fetched < maxScan) {
      const batch = await admin.auth.admin.listUsers({ page, perPage });
      const users = batch.data.users ?? [];
      if (users.length === 0) break;
      confirmed += users.filter((u) => Boolean(u.email_confirmed_at)).length;
      fetched += users.length;
      if (users.length < perPage) break;
      page += 1;
    }
    verified = confirmed;
  } catch {
    verified = 0;
  }

  return {
    restaurants: {
      total: restaurantsTotal.count ?? 0,
      active: restaurantsActive.count ?? 0,
      inactive: restaurantsInactive.count ?? 0,
      suspended: restaurantsSuspended.count ?? 0,
      createdLast7Days: restaurants7d.count ?? 0,
      createdLast30Days: restaurants30d.count ?? 0,
    },
    users: {
      total: usersTotal.count ?? 0,
      active: usersActive.count ?? 0,
      disabled: usersDisabled.count ?? 0,
      verified,
    },
    subscriptions: statusCounts,
    revenue: {
      currentPeriodAmount: sumAmount(paymentsSuccessCurrent.data),
      previousPeriodAmount: sumAmount(paymentsSuccessPrevious.data),
      successfulPayments: paymentsSuccessCount.count ?? 0,
      failedPayments: paymentsFailedCount.count ?? 0,
      currency,
    },
  };
}
