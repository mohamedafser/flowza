import type { Enums, Tables } from "@/types/database";
import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import type { adminUserListSchema } from "@/lib/validations/admin";
import {
  buildPageResult,
  emptyPage,
  escapeIlike,
  requireAdminClient,
  type PageResult,
} from "@/services/admin/admin-client";
import { writePlatformAuditLog } from "@/services/audit";
import type { z } from "zod";

export type AdminUserListQuery = z.infer<typeof adminUserListSchema>;

export type AdminUserListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
  accountStatus: Enums<"account_status">;
  platformRole: Enums<"platform_role"> | null;
  createdAt: string;
  lastSignInAt: string | null;
  restaurantCount: number;
  roles: string[];
};

export type AdminUserDetail = {
  profile: Tables<"profiles">;
  email: string | null;
  emailVerified: boolean;
  lastSignInAt: string | null;
  memberships: Array<{
    restaurantId: string;
    restaurantName: string;
    role: Enums<"member_role">;
    status: Enums<"member_status">;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    restaurantId: string | null;
    createdAt: string;
  }>;
};

export async function listAdminUsers(
  query: AdminUserListQuery,
): Promise<PageResult<AdminUserListItem>> {
  await requirePlatformPermission("platform.users.view");
  const admin = requireAdminClient();
  const { page, pageSize } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let profileQuery = admin
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.accountStatus !== "ALL") {
    profileQuery = profileQuery.eq("account_status", query.accountStatus);
  }

  const search = query.q?.trim();
  if (search) {
    const like = `%${escapeIlike(search)}%`;
    if (search.includes("@")) {
      try {
        const { data } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const ids = (data.users ?? [])
          .filter((u) =>
            u.email?.toLowerCase().includes(search.toLowerCase()),
          )
          .map((u) => u.id);
        if (ids.length === 0) return emptyPage(page, pageSize);
        profileQuery = profileQuery.in("id", ids);
      } catch {
        return emptyPage(page, pageSize);
      }
    } else {
      profileQuery = profileQuery.ilike("full_name", like);
    }
  }

  if (query.restaurantId || query.role !== "ALL") {
    let memberQuery = admin.from("restaurant_members").select("user_id");
    if (query.restaurantId) {
      memberQuery = memberQuery.eq("restaurant_id", query.restaurantId);
    }
    if (query.role !== "ALL") {
      memberQuery = memberQuery.eq("role", query.role);
    }
    const { data: memberRows } = await memberQuery;
    const ids = [...new Set((memberRows ?? []).map((m) => m.user_id))];
    if (ids.length === 0) return emptyPage(page, pageSize);
    profileQuery = profileQuery.in("id", ids);
  }

  const { data: profiles, count, error } = await profileQuery;
  if (error || !profiles) return emptyPage(page, pageSize);

  const ids = profiles.map((p) => p.id);
  if (ids.length === 0) return emptyPage(page, pageSize);

  const { data: memberships } = await admin
    .from("restaurant_members")
    .select("user_id, role")
    .eq("status", "ACTIVE")
    .in("user_id", ids);

  const rolesByUser = new Map<string, string[]>();
  const restaurantCount = new Map<string, number>();
  for (const row of memberships ?? []) {
    const roles = rolesByUser.get(row.user_id) ?? [];
    if (!roles.includes(row.role)) roles.push(row.role);
    rolesByUser.set(row.user_id, roles);
    restaurantCount.set(
      row.user_id,
      (restaurantCount.get(row.user_id) ?? 0) + 1,
    );
  }

  const authById = new Map<
    string,
    { email: string | null; verified: boolean; lastSignInAt: string | null }
  >();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        authById.set(id, {
          email: data.user?.email ?? null,
          verified: Boolean(data.user?.email_confirmed_at),
          lastSignInAt: data.user?.last_sign_in_at ?? null,
        });
      } catch {
        authById.set(id, {
          email: null,
          verified: false,
          lastSignInAt: null,
        });
      }
    }),
  );

  let items: AdminUserListItem[] = profiles.map((profile) => {
    const auth = authById.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: auth?.email ?? null,
      emailVerified: auth?.verified ?? false,
      accountStatus: profile.account_status,
      platformRole: profile.platform_role,
      createdAt: profile.created_at,
      lastSignInAt: auth?.lastSignInAt ?? null,
      restaurantCount: restaurantCount.get(profile.id) ?? 0,
      roles: rolesByUser.get(profile.id) ?? [],
    };
  });

  if (query.verification === "VERIFIED") {
    items = items.filter((u) => u.emailVerified);
  } else if (query.verification === "UNVERIFIED") {
    items = items.filter((u) => !u.emailVerified);
  }

  const total =
    query.verification !== "ALL" ? items.length : (count ?? items.length);

  return buildPageResult(items, total, page, pageSize);
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  await requirePlatformPermission("platform.users.view");
  const admin = requireAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  let email: string | null = null;
  let emailVerified = false;
  let lastSignInAt: string | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    email = data.user?.email ?? null;
    emailVerified = Boolean(data.user?.email_confirmed_at);
    lastSignInAt = data.user?.last_sign_in_at ?? null;
  } catch {
    // ignore
  }

  const [{ data: memberships }, { data: audit }] = await Promise.all([
    admin
      .from("restaurant_members")
      .select(
        "restaurant_id, role, status, restaurants:restaurants(id, name)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    admin
      .from("audit_logs")
      .select("id, action, entity_type, restaurant_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    profile,
    email,
    emailVerified,
    lastSignInAt,
    memberships: (memberships ?? []).map((row) => {
      const restaurant = Array.isArray(row.restaurants)
        ? row.restaurants[0]
        : row.restaurants;
      return {
        restaurantId: row.restaurant_id,
        restaurantName: restaurant?.name ?? "Unknown",
        role: row.role,
        status: row.status,
      };
    }),
    recentAudit: (audit ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      restaurantId: row.restaurant_id,
      createdAt: row.created_at,
    })),
  };
}

export async function updateAdminUserAccountStatus(
  userId: string,
  accountStatus: Enums<"account_status">,
): Promise<Tables<"profiles">> {
  const context = await requirePlatformPermission("platform.users.manage");
  const admin = requireAdminClient();

  if (userId === context.user.id) {
    throw new Error("You cannot disable your own account.");
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    throw new Error("User not found.");
  }

  if (existing.platform_role === "SUPER_ADMIN" && accountStatus === "DISABLED") {
    throw new Error("Cannot disable a SUPER_ADMIN account from this panel.");
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ account_status: accountStatus })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to update user status.");
  }

  // Ban/unban in Supabase Auth so sessions cannot continue.
  try {
    if (accountStatus === "DISABLED") {
      await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });
    } else {
      await admin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });
    }
  } catch {
    // Profile flag is still authoritative for app gates.
  }

  await writePlatformAuditLog({
    userId: context.user.id,
    action: accountStatus === "DISABLED" ? "USER_DISABLED" : "USER_REENABLED",
    entityType: "user",
    entityId: userId,
    metadata: { accountStatus },
  });

  return data;
}
