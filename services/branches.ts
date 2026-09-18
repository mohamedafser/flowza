import {
  AuthorizationError,
  requirePermission,
  requireRestaurantMembership,
} from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import { uniqueSlug } from "@/lib/utils/slug";
import type {
  BranchListQuery,
  SetBranchStatusInput,
} from "@/lib/validations/branch";
import type { Branch } from "@/lib/context/restaurant";
import { writeAuditLog } from "@/services/audit";
import { createClient } from "@/lib/supabase/server";

async function restaurantTimezone(
  restaurantId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();
  return data?.timezone ?? null;
}

export type BranchWritePayload = {
  name: string;
  slug: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  useRestaurantTimezone: boolean;
};

export type CreateBranchPayload = BranchWritePayload & {
  restaurantId: string;
};

export type UpdateBranchPayload = BranchWritePayload & {
  branchId: string;
};

export type BranchListResult = {
  items: Branch[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  offset: number;
  filters: {
    q?: string;
    city?: string;
    country?: string;
    status: BranchListQuery["status"];
    sort: BranchListQuery["sort"];
    order: BranchListQuery["order"];
  };
};

/** Escape characters that are special in Postgres ILIKE patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function buildIlikeOrFilter(term: string, columns: readonly string[]): string {
  const pattern = `%${escapeIlikePattern(term)}%`;
  const quoted = `"${pattern.replace(/"/g, '\\"')}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

/** RLS-backed list. Caller should already know the user is a member. */
export async function listBranchesByRestaurantId(
  restaurantId: string,
): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

/** Active branches only — filtered in the database. */
export async function listActiveBranchesByRestaurantId(
  restaurantId: string,
): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Server-side search + pagination for branches.
 * All filters (q, status, city, country, sort) are applied in Postgres.
 */
export async function searchBranches(
  restaurantId: string,
  query: BranchListQuery,
): Promise<BranchListResult> {
  await requireRestaurantMembership(restaurantId);

  const page = query.page;
  const pageSize = query.pageSize;
  const offset = (page - 1) * pageSize;
  const to = offset + pageSize - 1;

  const supabase = await createClient();
  let request = supabase
    .from("branches")
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId);

  if (query.status === "active") {
    request = request.eq("is_active", true);
  } else if (query.status === "inactive") {
    request = request.eq("is_active", false);
  }

  if (query.city) {
    request = request.ilike("city", `%${escapeIlikePattern(query.city)}%`);
  }

  if (query.country) {
    request = request.ilike(
      "country",
      `%${escapeIlikePattern(query.country)}%`,
    );
  }

  if (query.q) {
    request = request.or(
      buildIlikeOrFilter(query.q, [
        "name",
        "slug",
        "city",
        "state",
        "country",
        "email",
        "phone",
        "address_line_1",
      ]),
    );
  }

  const { data, error, count } = await request
    .order(query.sort, {
      ascending: query.order === "asc",
      nullsFirst: false,
    })
    .order("id", { ascending: true })
    .range(offset, to);

  const empty = (): BranchListResult => ({
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
    offset,
    filters: {
      q: query.q,
      city: query.city,
      country: query.country,
      status: query.status,
      sort: query.sort,
      order: query.order,
    },
  });

  if (error) {
    return empty();
  }

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: data ?? [],
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
    offset,
    filters: {
      q: query.q,
      city: query.city,
      country: query.country,
      status: query.status,
      sort: query.sort,
      order: query.order,
    },
  };
}

export async function getBranches(restaurantId: string): Promise<Branch[]> {
  await requireRestaurantMembership(restaurantId);
  return listBranchesByRestaurantId(restaurantId);
}

export async function getActiveBranches(
  restaurantId: string,
): Promise<Branch[]> {
  await requireRestaurantMembership(restaurantId);
  return listActiveBranchesByRestaurantId(restaurantId);
}

export async function getBranch(branchId: string): Promise<Branch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  await requireRestaurantMembership(data.restaurant_id);
  return data;
}

async function assertBranchBelongsToRestaurant(
  branchId: string,
  restaurantId?: string,
): Promise<Branch> {
  const branch = await getBranch(branchId);
  if (!branch) {
    throw new AuthorizationError("FORBIDDEN", "Branch not found.");
  }
  if (restaurantId && branch.restaurant_id !== restaurantId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Branch does not belong to this restaurant.",
    );
  }
  return branch;
}

async function allocateBranchSlug(
  restaurantId: string,
  desired: string,
  excludeBranchId?: string,
): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id, slug")
    .eq("restaurant_id", restaurantId);

  const existing = new Set(
    (data ?? [])
      .filter((row) => row.id !== excludeBranchId)
      .map((row) => row.slug),
  );

  return uniqueSlug(desired, existing);
}

export type BranchMutationResult =
  | { ok: true; branch: Branch }
  | {
      ok: false;
      message: string;
      code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "UNKNOWN";
    };

export async function createBranch(
  input: CreateBranchPayload,
): Promise<BranchMutationResult> {
  const context = await requirePermission(
    input.restaurantId,
    "restaurant.manage",
  );
  const timezone = input.useRestaurantTimezone
    ? ((await restaurantTimezone(input.restaurantId)) ?? input.timezone)
    : input.timezone;
  const supabase = await createClient();
  const slug = await allocateBranchSlug(input.restaurantId, input.slug);

  const { data, error } = await supabase
    .from("branches")
    .insert({
      restaurant_id: input.restaurantId,
      name: input.name,
      slug,
      address_line_1: input.addressLine1,
      address_line_2: input.addressLine2,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country: input.country,
      phone: input.phone,
      email: input.email,
      timezone,
      use_restaurant_timezone: input.useRestaurantTimezone,
      is_active: true,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    const message = safeDatabaseMessage(
      error,
      "Unable to create branch. Please try again.",
    );
    return {
      ok: false,
      code: /slug/i.test(message) ? "CONFLICT" : "UNKNOWN",
      message,
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create branch. Please try again.",
    };
  }

  await writeAuditLog({
    restaurantId: input.restaurantId,
    userId: context.user.id,
    action: "branch.created",
    entityType: "branch",
    entityId: data.id,
    metadata: { name: data.name, slug: data.slug },
  });

  return { ok: true, branch: data };
}

export async function updateBranch(
  input: UpdateBranchPayload,
): Promise<BranchMutationResult> {
  const existing = await assertBranchBelongsToRestaurant(input.branchId);
  const context = await requirePermission(
    existing.restaurant_id,
    "restaurant.manage",
  );
  const timezone = input.useRestaurantTimezone
    ? ((await restaurantTimezone(existing.restaurant_id)) ?? input.timezone)
    : input.timezone;
  const supabase = await createClient();
  const slug = await allocateBranchSlug(
    existing.restaurant_id,
    input.slug,
    existing.id,
  );

  const { data, error } = await supabase
    .from("branches")
    .update({
      name: input.name,
      slug,
      address_line_1: input.addressLine1,
      address_line_2: input.addressLine2,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country: input.country,
      phone: input.phone,
      email: input.email,
      timezone,
      use_restaurant_timezone: input.useRestaurantTimezone,
    })
    .eq("id", existing.id)
    .eq("restaurant_id", existing.restaurant_id)
    .select("*")
    .maybeSingle();

  if (error) {
    const message = safeDatabaseMessage(
      error,
      "Unable to update branch. Please try again.",
    );
    return {
      ok: false,
      code: /slug/i.test(message) ? "CONFLICT" : "UNKNOWN",
      message,
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Branch not found.",
    };
  }

  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: context.user.id,
    action: "branch.updated",
    entityType: "branch",
    entityId: data.id,
    metadata: { name: data.name, slug: data.slug },
  });

  return { ok: true, branch: data };
}

export async function setBranchStatus(
  input: SetBranchStatusInput,
): Promise<BranchMutationResult> {
  const existing = await assertBranchBelongsToRestaurant(input.branchId);
  const context = await requirePermission(
    existing.restaurant_id,
    "restaurant.manage",
  );

  if (existing.is_active === input.isActive) {
    return { ok: true, branch: existing };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .update({ is_active: input.isActive })
    .eq("id", existing.id)
    .eq("restaurant_id", existing.restaurant_id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update branch status. Please try again.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: context.user.id,
    action: input.isActive ? "branch.activated" : "branch.deactivated",
    entityType: "branch",
    entityId: data.id,
    metadata: { name: data.name, isActive: data.is_active },
  });

  return { ok: true, branch: data };
}
