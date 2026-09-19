import {
  requirePermission,
  requireRestaurantMembership,
} from "@/lib/auth/guards";
import type { Restaurant } from "@/lib/auth/session";
import {
  getUserMemberships,
  type MembershipWithRestaurant,
} from "@/lib/auth/session";
import { safeDatabaseMessage } from "@/lib/errors/action";
import { createClient } from "@/lib/supabase/server";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { writeAuditLog } from "@/services/audit";

export type RestaurantWritePayload = {
  name: string;
  email: string;
  phone: string;
  website: string | null;
  description: string | null;
  timezone: string;
};

export async function getUserRestaurants(
  userId: string,
): Promise<MembershipWithRestaurant[]> {
  return getUserMemberships(userId);
}

export async function getRestaurant(
  restaurantId: string,
): Promise<Restaurant | null> {
  await requireRestaurantMembership(restaurantId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function allocateRestaurantSlug(name: string): Promise<string> {
  const supabase = await createClient();
  const base = slugify(name);
  const { data } = await supabase
    .from("restaurants")
    .select("slug")
    .ilike("slug", `${base}%`);

  const existing = new Set((data ?? []).map((row) => row.slug));
  return uniqueSlug(base, existing);
}

function isMissingRpcError(error: { message?: string; code?: string } | null) {
  if (!error?.message) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .* does not exist|schema cache/i.test(
      error.message,
    )
  );
}

export type CreateRestaurantResult =
  | { ok: true; restaurant: Restaurant; alreadyExisted: boolean }
  | { ok: false; message: string; code: "CONFLICT" | "UNKNOWN" };

async function createRestaurantViaRpc(
  input: RestaurantWritePayload,
  slug: string,
): Promise<
  | { ok: true; restaurant: Restaurant }
  | {
      ok: false;
      error: { message?: string; code?: string };
      missingRpc: boolean;
    }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_restaurant_with_owner", {
    p_name: input.name,
    p_slug: slug,
    p_email: input.email,
    p_phone: input.phone,
    p_website: input.website,
    p_description: input.description,
    p_timezone: input.timezone,
  });

  if (!error && data) {
    return { ok: true, restaurant: data };
  }

  return {
    ok: false,
    error: error ?? { message: "Unknown RPC error" },
    missingRpc: isMissingRpcError(error),
  };
}

/**
 * Fallback when the onboarding RPC migration has not been applied yet.
 */
async function createRestaurantDirect(
  userId: string,
  input: RestaurantWritePayload,
  slug: string,
): Promise<CreateRestaurantResult> {
  const supabase = await createClient();
  const restaurantId = crypto.randomUUID();

  // Ensure profile row exists for FK + membership.
  await supabase.from("profiles").upsert({ id: userId }, { onConflict: "id" });

  const { error: insertError } = await supabase.from("restaurants").insert({
    id: restaurantId,
    name: input.name,
    slug,
    email: input.email,
    phone: input.phone,
    website: input.website,
    description: input.description,
    timezone: input.timezone,
    status: "ACTIVE",
  });

  if (insertError) {
    return {
      ok: false,
      code: /slug|duplicate/i.test(insertError.message)
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        insertError,
        "Unable to create restaurant. Please try again.",
      ),
    };
  }

  const { error: memberError } = await supabase
    .from("restaurant_members")
    .insert({
      restaurant_id: restaurantId,
      user_id: userId,
      role: "OWNER",
      status: "ACTIVE",
    });

  if (memberError) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        memberError,
        "Restaurant was created but ownership could not be assigned. Apply the latest Supabase migrations and retry.",
      ),
    };
  }

  const { data: created, error: selectError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (selectError || !created) {
    return {
      ok: false,
      code: "UNKNOWN",
      message:
        "Restaurant was created but could not be loaded. Refresh and try signing in again.",
    };
  }

  return { ok: true, restaurant: created, alreadyExisted: false };
}

/**
 * Creates a restaurant + OWNER membership for the current user.
 * Prefer SECURITY DEFINER RPC; fall back to direct inserts if RPC is missing.
 */
export async function createRestaurant(
  userId: string,
  input: RestaurantWritePayload,
): Promise<CreateRestaurantResult> {
  const existingMemberships = await getUserMemberships(userId);
  if (existingMemberships.length > 0) {
    return {
      ok: true,
      restaurant: existingMemberships[0]!.restaurant,
      alreadyExisted: true,
    };
  }

  let slug = await allocateRestaurantSlug(input.name);
  let lastError: { message?: string; code?: string } | null = null;
  let useDirectFallback = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      slug = uniqueSlug(`${slugify(input.name)}-${attempt + 1}`, [slug]);
    }

    if (!useDirectFallback) {
      const rpcResult = await createRestaurantViaRpc(input, slug);
      if (rpcResult.ok) {
        await writeAuditLog({
          restaurantId: rpcResult.restaurant.id,
          userId,
          action: "restaurant.created",
          entityType: "restaurant",
          entityId: rpcResult.restaurant.id,
          metadata: {
            name: rpcResult.restaurant.name,
            slug: rpcResult.restaurant.slug,
          },
        });
        return {
          ok: true,
          restaurant: rpcResult.restaurant,
          alreadyExisted: false,
        };
      }

      lastError = rpcResult.error;
      if (rpcResult.missingRpc) {
        useDirectFallback = true;
      } else if (
        /duplicate key|unique.*slug|restaurants_slug/i.test(
          rpcResult.error.message ?? "",
        )
      ) {
        continue;
      } else {
        const raced = await getUserMemberships(userId);
        if (raced.length > 0) {
          return {
            ok: true,
            restaurant: raced[0]!.restaurant,
            alreadyExisted: true,
          };
        }
        return {
          ok: false,
          code: "UNKNOWN",
          message: safeDatabaseMessage(
            rpcResult.error,
            "Unable to create restaurant. Please try again.",
          ),
        };
      }
    }

    if (useDirectFallback) {
      const direct = await createRestaurantDirect(userId, input, slug);
      if (direct.ok) {
        await writeAuditLog({
          restaurantId: direct.restaurant.id,
          userId,
          action: "restaurant.created",
          entityType: "restaurant",
          entityId: direct.restaurant.id,
          metadata: {
            name: direct.restaurant.name,
            slug: direct.restaurant.slug,
          },
        });
        return direct;
      }

      lastError = { message: direct.message };
      if (direct.code === "CONFLICT") {
        continue;
      }

      const raced = await getUserMemberships(userId);
      if (raced.length > 0) {
        return {
          ok: true,
          restaurant: raced[0]!.restaurant,
          alreadyExisted: true,
        };
      }
      return direct;
    }
  }

  const raced = await getUserMemberships(userId);
  if (raced.length > 0) {
    return {
      ok: true,
      restaurant: raced[0]!.restaurant,
      alreadyExisted: true,
    };
  }

  return {
    ok: false,
    code: /slug/i.test(lastError?.message ?? "") ? "CONFLICT" : "UNKNOWN",
    message: safeDatabaseMessage(
      lastError,
      "Unable to create restaurant. Please try again.",
    ),
  };
}

export type UpdateRestaurantResult =
  | { ok: true; restaurant: Restaurant }
  | { ok: false; message: string; code: "FORBIDDEN" | "NOT_FOUND" | "UNKNOWN" };

export async function updateRestaurant(
  restaurantId: string,
  input: RestaurantWritePayload,
): Promise<UpdateRestaurantResult> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .update({
      name: input.name,
      email: input.email,
      phone: input.phone,
      website: input.website,
      description: input.description,
      timezone: input.timezone,
    })
    .eq("id", restaurantId)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update restaurant. Please try again.",
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Restaurant not found.",
    };
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "restaurant.updated",
    entityType: "restaurant",
    entityId: restaurantId,
    metadata: { name: data.name },
  });

  return { ok: true, restaurant: data };
}

export async function updateRestaurantLogoUrl(
  restaurantId: string,
  logoUrl: string | null,
): Promise<UpdateRestaurantResult> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("restaurants")
    .update({ logo_url: logoUrl })
    .eq("id", restaurantId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update restaurant logo. Please try again.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "restaurant.logo_updated",
    entityType: "restaurant",
    entityId: restaurantId,
    metadata: { hasLogo: Boolean(logoUrl) },
  });

  return { ok: true, restaurant: data };
}
