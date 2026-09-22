import {
  AuthorizationError,
  requirePermission,
  requireRestaurantMembership,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { getDashboardDateRange } from "@/lib/analytics/date-range";
import { resolveBranchTimezone } from "@/lib/utils/timezone";
import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/lib/context/restaurant";
import type { Permission } from "@/lib/auth/permissions";

export type AuthorizedAnalyticsBranch = {
  branch: Branch;
  restaurantTimezone: string;
  timezone: string;
  context: Awaited<ReturnType<typeof requirePermission>>;
};

export async function loadAuthorizedAnalyticsBranch(
  branchId: string,
  permission: Permission,
): Promise<AuthorizedAnalyticsBranch> {
  return loadAuthorizedAnalyticsBranchAny(branchId, [permission]);
}

/**
 * Authorize once for any of the given permissions (dashboard entry).
 * Avoids retrying membership/permission DB work for each candidate permission.
 */
export async function loadAuthorizedAnalyticsBranchAny(
  branchId: string,
  permissions: Permission[],
): Promise<AuthorizedAnalyticsBranch> {
  const auth = await requireVerifiedAuth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .maybeSingle();

  if (error || !data) {
    throw new AuthorizationError("FORBIDDEN", "Branch not found.");
  }

  if (auth.restaurant?.id && auth.restaurant.id !== data.restaurant_id) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Branch does not belong to the active restaurant.",
    );
  }

  const context = await requireRestaurantMembership(data.restaurant_id);
  const allowed = permissions.some((permission) =>
    hasPermission(context.role, permission),
  );

  if (!allowed) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have access to dashboard analytics.",
    );
  }

  const restaurantTimezone =
    context.membership.restaurant.timezone ||
    context.restaurant?.timezone ||
    "UTC";
  const timezone = resolveBranchTimezone({
    restaurantTimezone,
    branchTimezone: data.timezone,
    useRestaurantTimezone: data.use_restaurant_timezone,
  });

  return {
    branch: data,
    restaurantTimezone,
    timezone,
    context,
  };
}

export function resolveAnalyticsRange(
  timezone: string,
  input: {
    preset: Parameters<typeof getDashboardDateRange>[0]["preset"];
    startDate?: string;
    endDate?: string;
    now?: Date;
  },
) {
  return getDashboardDateRange({
    branchTimezone: timezone,
    preset: input.preset,
    startDate: input.startDate,
    endDate: input.endDate,
    now: input.now,
  });
}
