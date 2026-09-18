export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ["12h", "24h"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ms", label: "Malay" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES = LANGUAGES.map((item) => item.code) as [
  LanguageCode,
  ...LanguageCode[],
];

export function isDateFormat(value: string): value is DateFormat {
  return (DATE_FORMATS as readonly string[]).includes(value);
}

export function isTimeFormat(value: string): value is TimeFormat {
  return (TIME_FORMATS as readonly string[]).includes(value);
}

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}

export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  date: string;
  time: string;
};

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Calendar/clock parts for an instant in an IANA timezone.
 */
export function getZonedDateParts(
  instant: Date,
  timeZone: string,
): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const year = Number(partValue(parts, "year"));
  const month = Number(partValue(parts, "month"));
  const day = Number(partValue(parts, "day"));
  const hour = Number(partValue(parts, "hour"));
  const minute = Number(partValue(parts, "minute"));
  const weekdayName = partValue(parts, "weekday");
  const weekday = WEEKDAY_TO_ISO[weekdayName] ?? 1;
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { year, month, day, hour, minute, weekday, date, time };
}

export function formatDate(
  instant: Date,
  dateFormat: DateFormat,
  timeZone = "UTC",
): string {
  const { year, month, day } = getZonedDateParts(instant, timeZone);
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

export function formatTime(
  instant: Date,
  timeFormat: TimeFormat,
  timeZone = "UTC",
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: timeFormat === "12h" ? "h12" : "h23",
  }).format(instant);
}

export function formatTimeOfDay(time: string, timeFormat: TimeFormat): string {
  const normalized = normalizeTime(time);
  if (!normalized) return time;

  const [hourText, minuteText] = normalized.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const instant = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: timeFormat === "12h" ? "h12" : "h23",
  }).format(instant);
}

export function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatDisplayDate(
  date: string,
  dateFormat: DateFormat,
): string {
  if (!isValidDateString(date)) return date;
  const [year, month, day] = date.split("-");
  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return date;
    default:
      return `${day}/${month}/${year}`;
  }
}
