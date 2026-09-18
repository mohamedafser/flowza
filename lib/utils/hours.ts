import {
  formatTimeOfDay,
  normalizeTime,
  type TimeFormat,
} from "@/lib/utils/datetime";

export const WEEKDAYS = [
  { dayOfWeek: 1, name: "Monday" },
  { dayOfWeek: 2, name: "Tuesday" },
  { dayOfWeek: 3, name: "Wednesday" },
  { dayOfWeek: 4, name: "Thursday" },
  { dayOfWeek: 5, name: "Friday" },
  { dayOfWeek: 6, name: "Saturday" },
  { dayOfWeek: 7, name: "Sunday" },
] as const;

export type DayOfWeek = (typeof WEEKDAYS)[number]["dayOfWeek"];

export type OperatingPeriod = {
  openTime: string;
  closeTime: string;
  sortOrder?: number;
};

export type DaySchedule = {
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  periods: OperatingPeriod[];
};

export type WeekSchedule = DaySchedule[];

export type SpecialHoursEntry = {
  id?: string;
  date: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  reason: string | null;
  branchId: string | null;
};

export type HoursSource =
  "special-branch" | "special-restaurant" | "branch" | "restaurant" | "none";

export type ResolvedHours = {
  source: HoursSource;
  isClosed: boolean;
  periods: OperatingPeriod[];
  reason: string | null;
  usingRestaurantHours: boolean;
};

export function weekdayName(dayOfWeek: number): string {
  return WEEKDAYS.find((day) => day.dayOfWeek === dayOfWeek)?.name ?? "Unknown";
}

export function emptyWeekSchedule(): WeekSchedule {
  return WEEKDAYS.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    isClosed: true,
    periods: [],
  }));
}

export function defaultWeekSchedule(): WeekSchedule {
  return WEEKDAYS.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    isClosed: false,
    periods: [{ openTime: "11:00", closeTime: "23:00", sortOrder: 0 }],
  }));
}

export function mergeWeekSchedule(
  rows: Array<{
    dayOfWeek: number;
    isClosed: boolean;
    periods: OperatingPeriod[];
  }>,
): WeekSchedule {
  const byDay = new Map<number, DaySchedule>();
  for (const row of rows) {
    if (row.dayOfWeek < 1 || row.dayOfWeek > 7) continue;
    byDay.set(row.dayOfWeek, {
      dayOfWeek: row.dayOfWeek as DayOfWeek,
      isClosed: row.isClosed,
      periods: sortPeriods(row.periods),
    });
  }

  return WEEKDAYS.map((day) => {
    return (
      byDay.get(day.dayOfWeek) ?? {
        dayOfWeek: day.dayOfWeek,
        isClosed: true,
        periods: [],
      }
    );
  });
}

export function sortPeriods(periods: OperatingPeriod[]): OperatingPeriod[] {
  return [...periods]
    .map((period, index) => ({
      openTime: normalizeTime(period.openTime) ?? period.openTime,
      closeTime: normalizeTime(period.closeTime) ?? period.closeTime,
      sortOrder: period.sortOrder ?? index,
    }))
    .sort((left, right) => {
      const byTime = left.openTime.localeCompare(right.openTime);
      if (byTime !== 0) return byTime;
      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    })
    .map((period, index) => ({ ...period, sortOrder: index }));
}

export function periodsOverlap(
  left: OperatingPeriod,
  right: OperatingPeriod,
): boolean {
  return left.openTime < right.closeTime && right.openTime < left.closeTime;
}

export function periodsAreDuplicate(
  left: OperatingPeriod,
  right: OperatingPeriod,
): boolean {
  return left.openTime === right.openTime && left.closeTime === right.closeTime;
}

export type PeriodValidationIssue = {
  index?: number;
  message: string;
};

export function validatePeriods(
  periods: OperatingPeriod[],
  isClosed: boolean,
): PeriodValidationIssue[] {
  const issues: PeriodValidationIssue[] = [];

  if (isClosed && periods.length > 0) {
    issues.push({ message: "Closed days cannot contain active periods." });
    return issues;
  }

  if (!isClosed && periods.length === 0) {
    issues.push({ message: "Open days need at least one period." });
    return issues;
  }

  const normalized = periods.map((period, index) => ({
    index,
    openTime: normalizeTime(period.openTime),
    closeTime: normalizeTime(period.closeTime),
  }));

  for (const period of normalized) {
    if (!period.openTime || !period.closeTime) {
      issues.push({
        index: period.index,
        message: "Enter a valid opening and closing time.",
      });
      continue;
    }
    if (period.openTime >= period.closeTime) {
      issues.push({
        index: period.index,
        message: "Start time must be before end time.",
      });
    }
  }

  if (issues.length > 0) {
    return issues;
  }

  const ordered = [...normalized].sort((left, right) =>
    (left.openTime ?? "").localeCompare(right.openTime ?? ""),
  );

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]!;
    const next = ordered[index + 1];
    if (!next) continue;

    const currentPeriod = {
      openTime: current.openTime!,
      closeTime: current.closeTime!,
    };
    const nextPeriod = {
      openTime: next.openTime!,
      closeTime: next.closeTime!,
    };

    if (periodsAreDuplicate(currentPeriod, nextPeriod)) {
      issues.push({
        index: next.index,
        message: "Duplicate periods are not allowed.",
      });
      continue;
    }

    if (periodsOverlap(currentPeriod, nextPeriod)) {
      issues.push({
        index: next.index,
        message: "Periods cannot overlap.",
      });
    }
  }

  return issues;
}

export function validateWeekSchedule(days: WeekSchedule): string | null {
  if (days.length !== 7) {
    return "Schedule must include every day of the week.";
  }

  const seen = new Set<number>();
  for (const day of days) {
    if (seen.has(day.dayOfWeek)) {
      return "Each weekday can only appear once.";
    }
    seen.add(day.dayOfWeek);
    const issues = validatePeriods(day.periods, day.isClosed);
    if (issues[0]) {
      return `${weekdayName(day.dayOfWeek)}: ${issues[0].message}`;
    }
  }

  if (seen.size !== 7) {
    return "Schedule must include every day of the week.";
  }

  return null;
}

export function isWithinPeriods(
  time: string,
  periods: OperatingPeriod[],
): boolean {
  const normalized = normalizeTime(time);
  if (!normalized) return false;
  return periods.some((period) => {
    const open = normalizeTime(period.openTime);
    const close = normalizeTime(period.closeTime);
    if (!open || !close) return false;
    return normalized >= open && normalized < close;
  });
}

export function formatPeriodRange(
  period: OperatingPeriod,
  timeFormat: TimeFormat,
): string {
  return `${formatTimeOfDay(period.openTime, timeFormat)} – ${formatTimeOfDay(period.closeTime, timeFormat)}`;
}

export function formatDayHours(
  day: Pick<DaySchedule, "isClosed" | "periods">,
  timeFormat: TimeFormat,
): string {
  if (day.isClosed || day.periods.length === 0) {
    return "Closed";
  }
  return sortPeriods(day.periods)
    .map((period) => formatPeriodRange(period, timeFormat))
    .join(", ");
}

export function copyMondayToOtherDays(days: WeekSchedule): WeekSchedule {
  const monday = days.find((day) => day.dayOfWeek === 1);
  if (!monday) return days;

  return days.map((day) => {
    if (day.dayOfWeek === 1) return day;
    return {
      dayOfWeek: day.dayOfWeek,
      isClosed: monday.isClosed,
      periods: monday.periods.map((period, index) => ({
        ...period,
        sortOrder: index,
      })),
    };
  });
}

function specialForDate(
  entries: SpecialHoursEntry[],
  date: string,
): SpecialHoursEntry | undefined {
  return entries.find((entry) => entry.date === date);
}

/**
 * Resolution order: branch special → restaurant special → branch week → restaurant week.
 */
export function resolveHoursForDate(input: {
  date: string;
  branchSpecialHours?: SpecialHoursEntry[];
  restaurantSpecialHours?: SpecialHoursEntry[];
  branchWeek?: WeekSchedule | null;
  restaurantWeek?: WeekSchedule | null;
}): ResolvedHours {
  const branchSpecial = specialForDate(
    input.branchSpecialHours ?? [],
    input.date,
  );
  if (branchSpecial) {
    return {
      source: "special-branch",
      isClosed: branchSpecial.isClosed,
      periods: specialToPeriods(branchSpecial),
      reason: branchSpecial.reason,
      usingRestaurantHours: false,
    };
  }

  const restaurantSpecial = specialForDate(
    input.restaurantSpecialHours ?? [],
    input.date,
  );
  if (restaurantSpecial) {
    return {
      source: "special-restaurant",
      isClosed: restaurantSpecial.isClosed,
      periods: specialToPeriods(restaurantSpecial),
      reason: restaurantSpecial.reason,
      usingRestaurantHours: input.branchWeek == null,
    };
  }

  const weekday = isoWeekdayFromDateString(input.date);
  if (input.branchWeek) {
    const day = input.branchWeek.find((item) => item.dayOfWeek === weekday);
    if (day) {
      return {
        source: "branch",
        isClosed: day.isClosed,
        periods: sortPeriods(day.periods),
        reason: null,
        usingRestaurantHours: false,
      };
    }
  }

  if (input.restaurantWeek) {
    const day = input.restaurantWeek.find((item) => item.dayOfWeek === weekday);
    if (day) {
      return {
        source: "restaurant",
        isClosed: day.isClosed,
        periods: sortPeriods(day.periods),
        reason: null,
        usingRestaurantHours: true,
      };
    }
  }

  return {
    source: "none",
    isClosed: true,
    periods: [],
    reason: null,
    usingRestaurantHours: input.branchWeek == null,
  };
}

export function isOpenAt(resolved: ResolvedHours, time: string): boolean {
  if (resolved.isClosed) return false;
  return isWithinPeriods(time, resolved.periods);
}

export function isoWeekdayFromDateString(date: string): DayOfWeek {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const jsDay = utc.getUTCDay();
  return (jsDay === 0 ? 7 : jsDay) as DayOfWeek;
}

function specialToPeriods(entry: SpecialHoursEntry): OperatingPeriod[] {
  if (entry.isClosed || !entry.openTime || !entry.closeTime) {
    return [];
  }
  return [
    {
      openTime: normalizeTime(entry.openTime) ?? entry.openTime,
      closeTime: normalizeTime(entry.closeTime) ?? entry.closeTime,
      sortOrder: 0,
    },
  ];
}

export function weekHasConfiguredHours(
  week: WeekSchedule | null | undefined,
): boolean {
  if (!week || week.length === 0) return false;
  return week.some((day) => !day.isClosed || day.periods.length > 0);
}
