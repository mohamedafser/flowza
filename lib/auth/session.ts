import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  DASHBOARD_OVERVIEW_PATH,
  ONBOARDING_RESTAURANT_PATH,
  RESTAURANT_PREFERENCE_COOKIE,
  VERIFY_EMAIL_PATH,
} from "@/lib/auth/paths";
import type { MemberRole } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;
export type Restaurant = Tables<"restaurants">;
export type RestaurantMember = Tables<"restaurant_members">;

export type MembershipWithRestaurant = RestaurantMember & {
  restaurant: Restaurant;
};

export type AuthContext = {
  user: User;
  profile: Profile | null;
  memberships: MembershipWithRestaurant[];
  membership: MembershipWithRestaurant | null;
  restaurant: Restaurant | null;
  role: MemberRole | null;
};

export function isEmailVerified(user: User | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}

export async function getAuthUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function ensureProfile(
  user: User,
): Promise<{ profile: Profile | null; error: string | null }> {
  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    return { profile: null, error: selectError.message };
  }

  if (existing) {
    return { profile: existing, error: null };
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        avatar_url:
          (user.user_metadata?.avatar_url as string | undefined) || null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();

  if (insertError) {
    return { profile: null, error: insertError.message };
  }

  return { profile: created, error: null };
}

export async function getUserMemberships(
  userId: string,
): Promise<MembershipWithRestaurant[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurant_members")
    .select("*, restaurant:restaurants(*)")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data
    .filter(
      (row): row is RestaurantMember & { restaurant: Restaurant } =>
        row.restaurant !== null && typeof row.restaurant === "object",
    )
    .map((row) => ({
      ...row,
      restaurant: row.restaurant,
    }));
}

export async function resolvePreferredRestaurantId(
  memberships: MembershipWithRestaurant[],
): Promise<string | null> {
  if (memberships.length === 0) {
    return null;
  }

  const cookieStore = await cookies();
  const preferred = cookieStore.get(RESTAURANT_PREFERENCE_COOKIE)?.value;

  if (
    preferred &&
    memberships.some((membership) => membership.restaurant_id === preferred)
  ) {
    return preferred;
  }

  return memberships[0]?.restaurant_id ?? null;
}

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const { profile } = await ensureProfile(user);
  const memberships = await getUserMemberships(user.id);
  const restaurantId = await resolvePreferredRestaurantId(memberships);
  const membership =
    memberships.find((item) => item.restaurant_id === restaurantId) ?? null;

  return {
    user,
    profile,
    memberships,
    membership,
    restaurant: membership?.restaurant ?? null,
    role: membership?.role ?? null,
  };
});

export async function getMembershipForRestaurant(
  userId: string,
  restaurantId: string,
): Promise<MembershipWithRestaurant | null> {
  const memberships = await getUserMemberships(userId);
  return (
    memberships.find(
      (membership) => membership.restaurant_id === restaurantId,
    ) ?? null
  );
}

/**
 * Post-verification / post-login destination.
 * Users without a restaurant membership are sent to onboarding.
 */
export async function resolvePostAuthDestination(user: User): Promise<string> {
  if (!isEmailVerified(user)) {
    return VERIFY_EMAIL_PATH;
  }

  const memberships = await getUserMemberships(user.id);
  if (memberships.length === 0) {
    return ONBOARDING_RESTAURANT_PATH;
  }

  return DASHBOARD_OVERVIEW_PATH;
}
