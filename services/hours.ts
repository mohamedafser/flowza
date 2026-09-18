import {
  AuthorizationError,
  requirePermission,
  requireRestaurantMembership,
} from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import { normalizeTime } from "@/lib/utils/datetime";
import {
  mergeWeekSchedule,
  sortPeriods,
  type DayOfWeek,
  type SpecialHoursEntry,
  type WeekSchedule,
} from "@/lib/utils/hours";
import type {
  CreateSpecialHoursInput,
  SpecialHoursFields,
  UpdateOperatingHoursInput,
  UpdateSpecialHoursInput,
} from "@/lib/validations/hours";
import { getBranch } from "@/services/branches";
import { writeAuditLog } from "@/services/audit";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type OperatingHoursRow = Tables<"operating_hours">;
export type OperatingPeriodRow = Tables<"operating_periods">;
export type SpecialHoursRow = Tables<"special_hours">;

export type HoursMutationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      message: string;
      code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "UNKNOWN";
    };

type HoursWithPeriods = OperatingHoursRow & {
  periods: OperatingPeriodRow[] | null;
};

function toTime(value: string | null | undefined): string | null {
  return normalizeTime(value);
}

function rowToDay(row: HoursWithPeriods): {
  dayOfWeek: number;
  isClosed: boolean;
  periods: { openTime: string; closeTime: string; sortOrder: number }[];
} {
  return {
    dayOfWeek: row.day_of_week,
    isClosed: row.is_closed,
    periods: sortPeriods(
      (row.periods ?? []).map((period) => ({
        openTime: toTime(period.open_time) ?? period.open_time,
        closeTime: toTime(period.close_time) ?? period.close_time,
        sortOrder: period.sort_order,
      })),
    ).map((period, index) => ({
      openTime: period.openTime,
      closeTime: period.closeTime,
      sortOrder: period.sortOrder ?? index,
    })),
  };
}

function toSpecialEntry(row: SpecialHoursRow): SpecialHoursEntry & {
  id: string;
} {
  return {
    id: row.id,
    date: row.date,
    isClosed: row.is_closed,
    openTime: toTime(row.open_time),
    closeTime: toTime(row.close_time),
    reason: row.reason,
    branchId: row.branch_id,
  };
}

async function assertBranchInRestaurant(
  restaurantId: string,
  branchId: string | null | undefined,
): Promise<void> {
  if (!branchId) return;
  const branch = await getBranch(branchId);
  if (!branch || branch.restaurant_id !== restaurantId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Branch does not belong to this restaurant.",
    );
  }
}

export async function getOperatingHours(
  restaurantId: string,
  branchId?: string | null,
): Promise<WeekSchedule> {
  await requireRestaurantMembership(restaurantId);
  if (branchId) {
    await assertBranchInRestaurant(restaurantId, branchId);
  }

  const supabase = await createClient();
  let query = supabase
    .from("operating_hours")
    .select("*, periods:operating_periods(*)")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week", { ascending: true });

  query = branchId
    ? query.eq("branch_id", branchId)
    : query.is("branch_id", null);

  const { data, error } = await query;
  if (error || !data) {
    return mergeWeekSchedule([]);
  }

  return mergeWeekSchedule((data as HoursWithPeriods[]).map(rowToDay));
}

export async function getBranchOperatingHours(
  restaurantId: string,
  branchId: string,
): Promise<WeekSchedule | null> {
  await requireRestaurantMembership(restaurantId);
  await assertBranchInRestaurant(restaurantId, branchId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operating_hours")
    .select("*, periods:operating_periods(*)")
    .eq("restaurant_id", restaurantId)
    .eq("branch_id", branchId)
    .order("day_of_week", { ascending: true });

  if (error || !data || data.length === 0) {
    return null;
  }

  return mergeWeekSchedule((data as HoursWithPeriods[]).map(rowToDay));
}

export type OperatingHoursBundle = {
  restaurantHours: WeekSchedule;
  restaurantConfigured: boolean;
  branchHours: Record<string, WeekSchedule>;
};

export async function getOperatingHoursBundle(
  restaurantId: string,
): Promise<OperatingHoursBundle> {
  await requireRestaurantMembership(restaurantId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operating_hours")
    .select("*, periods:operating_periods(*)")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week", { ascending: true });

  const restaurantRows: HoursWithPeriods[] = [];
  const branchRows = new Map<string, HoursWithPeriods[]>();

  if (!error && data) {
    for (const row of data as HoursWithPeriods[]) {
      if (row.branch_id) {
        const list = branchRows.get(row.branch_id) ?? [];
        list.push(row);
        branchRows.set(row.branch_id, list);
      } else {
        restaurantRows.push(row);
      }
    }
  }

  const restaurantHours = mergeWeekSchedule(restaurantRows.map(rowToDay));
  const branchHours: Record<string, WeekSchedule> = {};
  for (const [branchId, rows] of branchRows) {
    branchHours[branchId] = mergeWeekSchedule(rows.map(rowToDay));
  }

  return {
    restaurantHours,
    restaurantConfigured: restaurantRows.length > 0,
    branchHours,
  };
}

async function replaceHours(
  restaurantId: string,
  branchId: string | null,
  days: UpdateOperatingHoursInput["days"],
): Promise<HoursMutationResult<WeekSchedule>> {
  const supabase = await createClient();

  let deleteQuery = supabase
    .from("operating_hours")
    .delete()
    .eq("restaurant_id", restaurantId);

  deleteQuery = branchId
    ? deleteQuery.eq("branch_id", branchId)
    : deleteQuery.is("branch_id", null);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        deleteError,
        "Unable to update operating hours. Please try again.",
      ),
    };
  }

  const hourRows = days.map((day) => ({
    restaurant_id: restaurantId,
    branch_id: branchId,
    day_of_week: day.dayOfWeek,
    is_closed: day.isClosed,
  }));

  const { data: insertedHours, error: insertHoursError } = await supabase
    .from("operating_hours")
    .insert(hourRows)
    .select("id, day_of_week");

  if (insertHoursError || !insertedHours) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        insertHoursError,
        "Unable to save operating hours. Please try again.",
      ),
    };
  }

  const hoursByDay = new Map<number, string>(
    insertedHours.map((row) => [row.day_of_week, row.id]),
  );

  const periodRows = days.flatMap((day) => {
    if (day.isClosed) return [];
    const hoursId = hoursByDay.get(day.dayOfWeek);
    if (!hoursId) return [];
    return sortPeriods(day.periods).map((period, index) => ({
      operating_hours_id: hoursId,
      open_time: period.openTime,
      close_time: period.closeTime,
      sort_order: index,
    }));
  });

  if (periodRows.length > 0) {
    const { error: periodError } = await supabase
      .from("operating_periods")
      .insert(periodRows);

    if (periodError) {
      return {
        ok: false,
        code: /overlap/i.test(periodError.message ?? "")
          ? "VALIDATION"
          : "UNKNOWN",
        message: safeDatabaseMessage(
          periodError,
          "Unable to save operating periods. Please try again.",
        ),
      };
    }
  }

  const schedule = mergeWeekSchedule(
    days.map((day) => ({
      dayOfWeek: day.dayOfWeek as DayOfWeek,
      isClosed: day.isClosed,
      periods: day.periods,
    })),
  );

  return { ok: true, data: schedule };
}

export async function updateOperatingHours(
  input: UpdateOperatingHoursInput,
): Promise<HoursMutationResult<WeekSchedule>> {
  const branchId = input.branchId ?? null;
  const context = await requirePermission(
    input.restaurantId,
    "restaurant.manage",
  );
  await assertBranchInRestaurant(input.restaurantId, branchId);

  const result = await replaceHours(input.restaurantId, branchId, input.days);
  if (!result.ok) return result;

  await writeAuditLog({
    restaurantId: input.restaurantId,
    userId: context.user.id,
    action: branchId ? "branch_hours.updated" : "operating_hours.updated",
    entityType: branchId ? "branch" : "operating_hours",
    entityId: branchId ?? input.restaurantId,
    metadata: { branchId },
  });

  return result;
}

export async function updateBranchOperatingHours(
  restaurantId: string,
  branchId: string,
  days: UpdateOperatingHoursInput["days"],
): Promise<HoursMutationResult<WeekSchedule>> {
  return updateOperatingHours({ restaurantId, branchId, days });
}

export async function clearBranchOperatingHours(
  restaurantId: string,
  branchId: string,
): Promise<HoursMutationResult<{ cleared: true }>> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  await assertBranchInRestaurant(restaurantId, branchId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("operating_hours")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("branch_id", branchId);

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to restore restaurant hours. Please try again.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "branch_hours.updated",
    entityType: "branch",
    entityId: branchId,
    metadata: { usingRestaurantHours: true },
  });

  return { ok: true, data: { cleared: true } };
}

export async function getSpecialHours(
  restaurantId: string,
  branchId?: string | null,
): Promise<Array<SpecialHoursEntry & { id: string }>> {
  await requireRestaurantMembership(restaurantId);
  if (branchId) {
    await assertBranchInRestaurant(restaurantId, branchId);
  }

  const supabase = await createClient();
  let query = supabase
    .from("special_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("date", { ascending: true });

  query = branchId
    ? query.eq("branch_id", branchId)
    : query.is("branch_id", null);

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data.map(toSpecialEntry);
}

export async function getSpecialHoursBundle(restaurantId: string): Promise<{
  restaurant: Array<SpecialHoursEntry & { id: string }>;
  byBranch: Record<string, Array<SpecialHoursEntry & { id: string }>>;
}> {
  await requireRestaurantMembership(restaurantId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("special_hours")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("date", { ascending: true });

  const restaurant: Array<SpecialHoursEntry & { id: string }> = [];
  const byBranch: Record<
    string,
    Array<SpecialHoursEntry & { id: string }>
  > = {};

  if (!error && data) {
    for (const row of data) {
      const entry = toSpecialEntry(row);
      if (row.branch_id) {
        const list = byBranch[row.branch_id] ?? [];
        list.push(entry);
        byBranch[row.branch_id] = list;
      } else {
        restaurant.push(entry);
      }
    }
  }

  return { restaurant, byBranch };
}

function specialFieldsToRow(fields: SpecialHoursFields) {
  return {
    date: fields.date,
    is_closed: fields.isClosed,
    open_time: fields.isClosed ? null : fields.openTime,
    close_time: fields.isClosed ? null : fields.closeTime,
    reason: fields.reason,
  };
}

export async function createSpecialHours(
  input: CreateSpecialHoursInput,
): Promise<HoursMutationResult<SpecialHoursEntry & { id: string }>> {
  const branchId = input.branchId ?? null;
  const context = await requirePermission(
    input.restaurantId,
    "restaurant.manage",
  );
  await assertBranchInRestaurant(input.restaurantId, branchId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("special_hours")
    .insert({
      restaurant_id: input.restaurantId,
      branch_id: branchId,
      ...specialFieldsToRow(input),
    })
    .select("*")
    .maybeSingle();

  if (error) {
    const duplicate = /special_hours_.*date_unique|duplicate key/i.test(
      error.message,
    );
    return {
      ok: false,
      code: duplicate ? "CONFLICT" : "UNKNOWN",
      message: duplicate
        ? "A special date already exists for this location."
        : safeDatabaseMessage(
            error,
            "Unable to add special hours. Please try again.",
          ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to add special hours. Please try again.",
    };
  }

  await writeAuditLog({
    restaurantId: input.restaurantId,
    userId: context.user.id,
    action: "special_hours.created",
    entityType: "special_hours",
    entityId: data.id,
    metadata: { date: data.date, branchId, isClosed: data.is_closed },
  });

  return { ok: true, data: toSpecialEntry(data) };
}

export async function updateSpecialHours(
  input: UpdateSpecialHoursInput,
): Promise<HoursMutationResult<SpecialHoursEntry & { id: string }>> {
  const context = await requirePermission(
    input.restaurantId,
    "restaurant.manage",
  );
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("special_hours")
    .select("*")
    .eq("id", input.specialHoursId)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();

  if (existingError || !existing) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Special hours not found.",
    };
  }

  const { data, error } = await supabase
    .from("special_hours")
    .update(specialFieldsToRow(input))
    .eq("id", existing.id)
    .eq("restaurant_id", input.restaurantId)
    .select("*")
    .maybeSingle();

  if (error) {
    const duplicate = /special_hours_.*date_unique|duplicate key/i.test(
      error.message,
    );
    return {
      ok: false,
      code: duplicate ? "CONFLICT" : "UNKNOWN",
      message: duplicate
        ? "A special date already exists for this location."
        : safeDatabaseMessage(
            error,
            "Unable to update special hours. Please try again.",
          ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Special hours not found.",
    };
  }

  await writeAuditLog({
    restaurantId: input.restaurantId,
    userId: context.user.id,
    action: "special_hours.updated",
    entityType: "special_hours",
    entityId: data.id,
    metadata: { date: data.date, isClosed: data.is_closed },
  });

  return { ok: true, data: toSpecialEntry(data) };
}

export async function deleteSpecialHours(
  restaurantId: string,
  specialHoursId: string,
): Promise<HoursMutationResult<{ deleted: true }>> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("special_hours")
    .select("id, date")
    .eq("id", specialHoursId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!existing) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Special hours not found.",
    };
  }

  const { error } = await supabase
    .from("special_hours")
    .delete()
    .eq("id", existing.id)
    .eq("restaurant_id", restaurantId);

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to delete special hours. Please try again.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "special_hours.deleted",
    entityType: "special_hours",
    entityId: existing.id,
    metadata: { date: existing.date },
  });

  return { ok: true, data: { deleted: true } };
}
