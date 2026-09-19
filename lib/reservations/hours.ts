import {
  resolveHoursForDate,
  weekHasConfiguredHours,
  type ResolvedHours,
  type SpecialHoursEntry,
  type WeekSchedule,
} from "@/lib/utils/hours";
import { resolveBranchTimezone } from "@/lib/utils/timezone";
import {
  zonedInstant,
  checkOperatingHours,
  normalizeReservationTime,
} from "@/lib/reservations/availability";
import {
  getBranchOperatingHours,
  getOperatingHours,
  getSpecialHours,
} from "@/services/hours";
import { getBranch } from "@/services/branches";
import { createClient } from "@/lib/supabase/server";

export type BranchOpenContext = {
  branchId: string;
  restaurantId: string;
  timezone: string;
  restaurantWeek: WeekSchedule;
  branchWeek: WeekSchedule | null;
  restaurantSpecialHours: SpecialHoursEntry[];
  branchSpecialHours: SpecialHoursEntry[];
};

export async function loadBranchOpenContext(
  branchId: string,
): Promise<BranchOpenContext | null> {
  const branch = await getBranch(branchId);
  if (!branch) {
    return null;
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, timezone")
    .eq("id", branch.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
    return null;
  }

  const timezone = resolveBranchTimezone({
    restaurantTimezone: restaurant.timezone,
    branchTimezone: branch.timezone,
    useRestaurantTimezone: branch.use_restaurant_timezone,
  });

  const [restaurantWeek, branchWeek, restaurantSpecialHours, branchSpecialHours] =
    await Promise.all([
      getOperatingHours(branch.restaurant_id),
      getBranchOperatingHours(branch.restaurant_id, branchId),
      getSpecialHours(branch.restaurant_id),
      getSpecialHours(branch.restaurant_id, branchId),
    ]);

  return {
    branchId,
    restaurantId: branch.restaurant_id,
    timezone,
    restaurantWeek,
    branchWeek: weekHasConfiguredHours(branchWeek) ? branchWeek : null,
    restaurantSpecialHours,
    branchSpecialHours,
  };
}

export function resolveBranchHoursAt(
  context: BranchOpenContext,
  date: string,
): ResolvedHours {
  return resolveHoursForDate({
    date,
    restaurantWeek: context.restaurantWeek,
    branchWeek: context.branchWeek,
    restaurantSpecialHours: context.restaurantSpecialHours,
    branchSpecialHours: context.branchSpecialHours,
  });
}

/**
 * Server-side open check for a branch local date+time using configured hours.
 * Prefer this over browser local time.
 */
export async function isBranchOpenAt(
  branchId: string,
  date: string,
  time: string,
): Promise<boolean> {
  const context = await loadBranchOpenContext(branchId);
  if (!context) {
    return false;
  }

  const resolved = resolveBranchHoursAt(context, date);
  return checkOperatingHours(resolved, normalizeReservationTime(time)) == null;
}

export async function isBranchOpenAtInstant(
  branchId: string,
  instant: Date,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("branch_is_open_at", {
    p_branch_id: branchId,
    p_at: instant.toISOString(),
  });

  if (error) {
    return false;
  }

  return Boolean(data);
}

export function branchLocalInstant(
  context: BranchOpenContext,
  date: string,
  time: string,
): Date {
  return zonedInstant(date, time, context.timezone);
}
