import {
  getZonedDateParts,
  isValidDateString,
} from "@/lib/utils/datetime";

export const DASHBOARD_DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "custom",
] as const;

export type DashboardDatePreset = (typeof DASHBOARD_DATE_PRESETS)[number];

export type DashboardDateGrouping = "hour" | "day";

export type DashboardDateRange = {
  preset: DashboardDatePreset;
  /** Inclusive local calendar start (YYYY-MM-DD) in branch timezone. */
  startDate: string;
  /** Inclusive local calendar end (YYYY-MM-DD) in branch timezone. */
  endDate: string;
  /** UTC instant for the start of startDate in the branch timezone. */
  startAt: string;
  /** UTC instant for the exclusive end (start of day after endDate). */
  endAtExclusive: string;
  timezone: string;
  grouping: DashboardDateGrouping;
  dayCount: number;
  label: string;
};

export type GetDashboardDateRangeInput = {
  branchTimezone: string;
  preset: DashboardDatePreset;
  startDate?: string;
  endDate?: string;
  now?: Date;
};

const PRESET_LABELS: Record<Exclude<DashboardDatePreset, "custom">, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function addCalendarDays(date: string, days: number): string {
  const [yearText, monthText, dayText] = date.split("-");
  const utc = Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText) + days,
  );
  const next = new Date(utc);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

function calendarDaysBetween(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Convert a local calendar date + clock time in an IANA timezone to a UTC Date.
 * Uses iterative offset correction so branch timezone is authoritative.
 */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  if (!isValidDateString(date)) {
    throw new Error("Invalid date string.");
  }

  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!timeMatch) {
    throw new Error("Invalid time string.");
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? "0");

  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedDateParts(new Date(utcMillis), timeZone);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = target - asIfUtc;
    if (delta === 0) break;
    utcMillis += delta;
  }

  return new Date(utcMillis);
}

export function startOfZonedDayUtc(date: string, timeZone: string): Date {
  return zonedDateTimeToUtc(date, "00:00:00", timeZone);
}

function resolvePresetDates(
  preset: DashboardDatePreset,
  today: string,
  startDate?: string,
  endDate?: string,
): { startDate: string; endDate: string } {
  switch (preset) {
    case "today":
      return { startDate: today, endDate: today };
    case "yesterday": {
      const yesterday = addCalendarDays(today, -1);
      return { startDate: yesterday, endDate: yesterday };
    }
    case "last_7_days":
      return { startDate: addCalendarDays(today, -6), endDate: today };
    case "last_30_days":
      return { startDate: addCalendarDays(today, -29), endDate: today };
    case "custom": {
      if (!startDate || !endDate) {
        throw new Error("Custom date range requires startDate and endDate.");
      }
      if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
        throw new Error("Custom date range contains an invalid date.");
      }
      if (startDate > endDate) {
        throw new Error("Custom date range start must be on or before end.");
      }
      const span = calendarDaysBetween(startDate, endDate);
      if (span > 90) {
        throw new Error("Custom date range cannot exceed 90 days.");
      }
      return { startDate, endDate };
    }
  }
}

function formatRangeLabel(
  preset: DashboardDatePreset,
  startDate: string,
  endDate: string,
): string {
  if (preset !== "custom") {
    return PRESET_LABELS[preset];
  }
  if (startDate === endDate) {
    return startDate;
  }
  return `${startDate} → ${endDate}`;
}

/**
 * Resolve an analytics date window in the branch timezone.
 * Never uses the browser/server local timezone for business dates.
 */
export function getDashboardDateRange(
  input: GetDashboardDateRangeInput,
): DashboardDateRange {
  const timezone = input.branchTimezone || "UTC";
  const now = input.now ?? new Date();
  const today = getZonedDateParts(now, timezone).date;
  const { startDate, endDate } = resolvePresetDates(
    input.preset,
    today,
    input.startDate,
    input.endDate,
  );

  const dayCount = calendarDaysBetween(startDate, endDate);
  const grouping: DashboardDateGrouping = dayCount <= 2 ? "hour" : "day";
  const startAt = startOfZonedDayUtc(startDate, timezone).toISOString();
  const endAtExclusive = startOfZonedDayUtc(
    addCalendarDays(endDate, 1),
    timezone,
  ).toISOString();

  return {
    preset: input.preset,
    startDate,
    endDate,
    startAt,
    endAtExclusive,
    timezone,
    grouping,
    dayCount,
    label: formatRangeLabel(input.preset, startDate, endDate),
  };
}

export function listDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

export function hourLabels(): string[] {
  return Array.from({ length: 24 }, (_, hour) => `${pad2(hour)}:00`);
}

export function formatHourRangeLabel(hour: number): string {
  const start = hour % 24;
  const end = (hour + 1) % 24;
  const format = (value: number) => {
    const suffix = value >= 12 ? "PM" : "AM";
    const twelve = value % 12 === 0 ? 12 : value % 12;
    return `${twelve} ${suffix}`;
  };
  return `${format(start)} → ${format(end)}`;
}

export { addCalendarDays };
