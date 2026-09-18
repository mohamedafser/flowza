import { cookies } from "next/headers";
import {
  BRANCH_PREFERENCE_COOKIE,
  RESTAURANT_PREFERENCE_COOKIE,
} from "@/lib/auth/paths";
import { hasPermission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";
import type {
  AuthContext,
  MembershipWithRestaurant,
  Restaurant,
} from "@/lib/auth/session";
import type { Tables } from "@/types/database";

export type Branch = Tables<"branches">;

export type RestaurantWorkspace = {
  auth: AuthContext;
  memberships: MembershipWithRestaurant[];
  membership: MembershipWithRestaurant | null;
  restaurant: Restaurant | null;
  role: MemberRole | null;
  canManageRestaurant: boolean;
  branches: Branch[];
  activeBranches: Branch[];
  branch: Branch | null;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function pickPreferredRestaurantId(
  memberships: MembershipWithRestaurant[],
  preferredId: string | null | undefined,
): string | null {
  if (memberships.length === 0) {
    return null;
  }

  if (
    preferredId &&
    memberships.some((membership) => membership.restaurant_id === preferredId)
  ) {
    return preferredId;
  }

  if (memberships.length === 1) {
    return memberships[0]!.restaurant_id;
  }

  return memberships[0]?.restaurant_id ?? null;
}

export function pickPreferredBranch(
  branches: Branch[],
  preferredId: string | null | undefined,
): Branch | null {
  const active = branches.filter((branch) => branch.is_active);
  if (active.length === 0) {
    return null;
  }

  if (preferredId) {
    const preferred = active.find((branch) => branch.id === preferredId);
    if (preferred) {
      return preferred;
    }
  }

  if (active.length === 1) {
    return active[0]!;
  }

  return active[0] ?? null;
}

export function buildWorkspace(
  auth: AuthContext,
  branches: Branch[],
  preferredBranchId: string | null | undefined,
): RestaurantWorkspace {
  const role = auth.role;
  const canManageRestaurant = role
    ? hasPermission(role, "restaurant.manage")
    : false;
  const activeBranches = branches.filter((branch) => branch.is_active);
  const branch = pickPreferredBranch(branches, preferredBranchId);

  return {
    auth,
    memberships: auth.memberships,
    membership: auth.membership,
    restaurant: auth.restaurant,
    role,
    canManageRestaurant,
    branches,
    activeBranches,
    branch,
  };
}

export async function readBranchPreferenceCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(BRANCH_PREFERENCE_COOKIE)?.value ?? null;
}

export async function setRestaurantPreferenceCookie(
  restaurantId: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(RESTAURANT_PREFERENCE_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function setBranchPreferenceCookie(
  branchId: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(BRANCH_PREFERENCE_COOKIE, branchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearBranchPreferenceCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(BRANCH_PREFERENCE_COOKIE);
}
