import type { Enums, Tables } from "@/types/database";
import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import {
  buildPageResult,
  emptyPage,
  escapeIlike,
  requireAdminClient,
  type PageResult,
} from "@/services/admin/admin-client";
import { writePlatformAuditLog } from "@/services/audit";
import { getUsageSummary } from "@/services/billing/usage.service";
import type { z } from "zod";
import type { adminRestaurantListSchema } from "@/lib/validations/admin";

export type AdminRestaurantListQuery = z.infer<typeof adminRestaurantListSchema>;

export type AdminRestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  status: Enums<"restaurant_status">;
  createdAt: string;
  logoUrl: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  branchCount: number;
  memberCount: number;
  planCode: string | null;
  subscriptionStatus: Enums<"subscription_status"> | null;
};

export type AdminRestaurantDetail = {
  restaurant: Tables<"restaurants">;
  owner: {
    id: string;
    fullName: string | null;
    email: string | null;
    accountStatus: Enums<"account_status">;
  } | null;
  branches: {
    total: number;
    active: number;
    inactive: number;
  };
  members: {
    total: number;
    byRole: Record<string, number>;
  };
  subscription: Tables<"subscriptions"> | null;
  plan: Tables<"plans"> | null;
  usage: Awaited<ReturnType<typeof getUsageSummary>> | null;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    userId: string | null;
  }>;
};

export async function listAdminRestaurants(
  query: AdminRestaurantListQuery,
): Promise<PageResult<AdminRestaurantListItem>> {
  await requirePlatformPermission("platform.restaurants.view");
  const admin = requireAdminClient();
  const { page, pageSize } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let restaurantQuery = admin
    .from("restaurants")
    .select(
      "id, name, slug, status, created_at, logo_url, organization_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.status !== "ALL") {
    restaurantQuery = restaurantQuery.eq("status", query.status);
  }
  if (query.createdFrom) {
    restaurantQuery = restaurantQuery.gte("created_at", query.createdFrom);
  }
  if (query.createdTo) {
    restaurantQuery = restaurantQuery.lte("created_at", query.createdTo);
  }

  const search = query.q?.trim();
  let matchedIds: string[] | null = null;

  if (search) {
    const like = `%${escapeIlike(search)}%`;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        search,
      );

    const [byName, byBranch, byOwnerProfile] = await Promise.all([
      isUuid
        ? admin.from("restaurants").select("id").eq("id", search)
        : admin.from("restaurants").select("id").ilike("name", like),
      admin.from("branches").select("restaurant_id").ilike("name", like),
      admin.from("profiles").select("id").ilike("full_name", like),
    ]);

    const ownerIds = (byOwnerProfile.data ?? []).map((p) => p.id);
    let ownerRestaurantIds: string[] = [];
    if (ownerIds.length > 0) {
      const { data: ownerMembers } = await admin
        .from("restaurant_members")
        .select("restaurant_id")
        .eq("role", "OWNER")
        .in("user_id", ownerIds);
      ownerRestaurantIds = (ownerMembers ?? []).map((m) => m.restaurant_id);
    }

    // Email search via auth admin is expensive; only when search looks like email.
    if (search.includes("@")) {
      try {
        const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const emailMatches = (data.users ?? []).filter(
          (u) => u.email?.toLowerCase().includes(search.toLowerCase()),
        );
        if (emailMatches.length > 0) {
          const { data: emailMembers } = await admin
            .from("restaurant_members")
            .select("restaurant_id")
            .eq("role", "OWNER")
            .in(
              "user_id",
              emailMatches.map((u) => u.id),
            );
          ownerRestaurantIds.push(
            ...(emailMembers ?? []).map((m) => m.restaurant_id),
          );
        }
      } catch {
        // ignore auth search failures
      }
    }

    matchedIds = [
      ...new Set([
        ...(byName.data ?? []).map((r) => r.id),
        ...(byBranch.data ?? []).map((b) => b.restaurant_id),
        ...ownerRestaurantIds,
      ]),
    ];

    if (matchedIds.length === 0) {
      return emptyPage(page, pageSize);
    }
    restaurantQuery = restaurantQuery.in("id", matchedIds);
  }

  const { data: restaurants, count, error } = await restaurantQuery;
  if (error || !restaurants) {
    return emptyPage(page, pageSize);
  }

  // Optional subscription filters require a second pass on this page's ids
  // plus filtering before pagination when heavily filtered — for correctness
  // with status/plan filters, re-query with subscription join when needed.
  const ids = restaurants.map((r) => r.id);
  if (ids.length === 0) {
    return emptyPage(page, pageSize);
  }

  const [owners, branches, members, subscriptions] = await Promise.all([
    admin
      .from("restaurant_members")
      .select("restaurant_id, user_id, profiles:profiles(id, full_name, account_status)")
      .eq("role", "OWNER")
      .in("restaurant_id", ids),
    admin.from("branches").select("restaurant_id").in("restaurant_id", ids),
    admin
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("status", "ACTIVE")
      .in("restaurant_id", ids),
    admin
      .from("subscriptions")
      .select("restaurant_id, plan, status")
      .in("restaurant_id", ids),
  ]);

  const ownerByRestaurant = new Map<
    string,
    { userId: string; fullName: string | null }
  >();
  for (const row of owners.data ?? []) {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : row.profiles;
    ownerByRestaurant.set(row.restaurant_id, {
      userId: row.user_id,
      fullName: profile?.full_name ?? null,
    });
  }

  const ownerEmails = new Map<string, string | null>();
  const uniqueOwnerIds = [
    ...new Set([...ownerByRestaurant.values()].map((o) => o.userId)),
  ];
  await Promise.all(
    uniqueOwnerIds.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        ownerEmails.set(userId, data.user?.email ?? null);
      } catch {
        ownerEmails.set(userId, null);
      }
    }),
  );

  const branchCount = new Map<string, number>();
  for (const row of branches.data ?? []) {
    branchCount.set(
      row.restaurant_id,
      (branchCount.get(row.restaurant_id) ?? 0) + 1,
    );
  }

  const memberCount = new Map<string, number>();
  for (const row of members.data ?? []) {
    memberCount.set(
      row.restaurant_id,
      (memberCount.get(row.restaurant_id) ?? 0) + 1,
    );
  }

  const subByRestaurant = new Map<
    string,
    { plan: string | null; status: Enums<"subscription_status"> }
  >();
  for (const row of subscriptions.data ?? []) {
    subByRestaurant.set(row.restaurant_id, {
      plan: row.plan,
      status: row.status,
    });
  }

  let items: AdminRestaurantListItem[] = restaurants.map((r) => {
    const owner = ownerByRestaurant.get(r.id);
    const sub = subByRestaurant.get(r.id);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: r.created_at,
      logoUrl: r.logo_url,
      ownerName: owner?.fullName ?? null,
      ownerEmail: owner ? (ownerEmails.get(owner.userId) ?? null) : null,
      branchCount: branchCount.get(r.id) ?? 0,
      memberCount: memberCount.get(r.id) ?? 0,
      planCode: sub?.plan ?? null,
      subscriptionStatus: sub?.status ?? null,
    };
  });

  if (query.plan) {
    const plan = query.plan.toUpperCase();
    items = items.filter((item) => item.planCode?.toUpperCase() === plan);
  }
  if (query.subscriptionStatus !== "ALL") {
    if (query.subscriptionStatus === "NONE") {
      items = items.filter((item) => !item.subscriptionStatus);
    } else {
      items = items.filter(
        (item) => item.subscriptionStatus === query.subscriptionStatus,
      );
    }
  }

  // When subscription filters shrink the page, report page-local totals.
  const total =
    query.plan || query.subscriptionStatus !== "ALL"
      ? items.length
      : (count ?? items.length);

  return buildPageResult(items, total, page, pageSize);
}

export async function getAdminRestaurantDetail(
  restaurantId: string,
): Promise<AdminRestaurantDetail | null> {
  await requirePlatformPermission("platform.restaurants.view");
  const admin = requireAdminClient();

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) return null;

  const [
    ownerRow,
    branchRows,
    memberRows,
    subscription,
    auditRows,
  ] = await Promise.all([
    admin
      .from("restaurant_members")
      .select(
        "user_id, profiles:profiles(id, full_name, account_status)",
      )
      .eq("restaurant_id", restaurantId)
      .eq("role", "OWNER")
      .maybeSingle(),
    admin
      .from("branches")
      .select("id, is_active")
      .eq("restaurant_id", restaurantId),
    admin
      .from("restaurant_members")
      .select("role, status")
      .eq("restaurant_id", restaurantId),
    admin
      .from("subscriptions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    admin
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, created_at, user_id")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  let owner: AdminRestaurantDetail["owner"] = null;
  if (ownerRow.data) {
    const ownerData = ownerRow.data;
    const profile = Array.isArray(ownerData.profiles)
      ? ownerData.profiles[0]
      : ownerData.profiles;
    let email: string | null = null;
    try {
      const { data } = await admin.auth.admin.getUserById(ownerData.user_id);
      email = data.user?.email ?? null;
    } catch {
      email = null;
    }
    owner = {
      id: ownerData.user_id,
      fullName: profile?.full_name ?? null,
      email,
      accountStatus: profile?.account_status ?? "ACTIVE",
    };
  }

  const byRole: Record<string, number> = {};
  let memberTotal = 0;
  for (const row of memberRows.data ?? []) {
    if (row.status !== "ACTIVE") continue;
    memberTotal += 1;
    byRole[row.role] = (byRole[row.role] ?? 0) + 1;
  }

  const branchList = branchRows.data ?? [];
  let plan: Tables<"plans"> | null = null;
  if (subscription.data?.plan_id) {
    const { data } = await admin
      .from("plans")
      .select("*")
      .eq("id", subscription.data.plan_id)
      .maybeSingle();
    plan = data;
  }

  const usage = await getUsageSummary(
    restaurantId,
    subscription.data?.current_period_start,
    subscription.data?.current_period_end,
  ).catch(() => null);

  return {
    restaurant,
    owner,
    branches: {
      total: branchList.length,
      active: branchList.filter((b) => b.is_active).length,
      inactive: branchList.filter((b) => !b.is_active).length,
    },
    members: { total: memberTotal, byRole },
    subscription: subscription.data,
    plan,
    usage,
    recentAudit: (auditRows.data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      userId: row.user_id,
    })),
  };
}

export async function updateAdminRestaurantStatus(
  restaurantId: string,
  status: Enums<"restaurant_status">,
): Promise<Tables<"restaurants">> {
  const context = await requirePlatformPermission("platform.restaurants.manage");
  const admin = requireAdminClient();

  const { data: existing } = await admin
    .from("restaurants")
    .select("id, status, organization_id, name")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!existing) {
    throw new Error("Restaurant not found.");
  }

  const { data, error } = await admin
    .from("restaurants")
    .update({ status })
    .eq("id", restaurantId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to update restaurant status.");
  }

  await admin
    .from("organizations")
    .update({ status })
    .eq("id", existing.organization_id);

  const action =
    status === "SUSPENDED" || status === "INACTIVE"
      ? "RESTAURANT_SUSPENDED"
      : "RESTAURANT_REACTIVATED";

  await writePlatformAuditLog({
    restaurantId,
    organizationId: existing.organization_id,
    userId: context.user.id,
    action,
    entityType: "restaurant",
    entityId: restaurantId,
    metadata: {
      from: existing.status,
      to: status,
      name: existing.name,
    },
  });

  return data;
}
