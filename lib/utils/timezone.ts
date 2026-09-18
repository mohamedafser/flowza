export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const;

const SUPPORTED_TIMEZONES: readonly string[] =
  typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC"];

export const TIMEZONES: readonly string[] = SUPPORTED_TIMEZONES.includes("UTC")
  ? SUPPORTED_TIMEZONES
  : ["UTC", ...SUPPORTED_TIMEZONES];

export function isValidTimezone(value: string): boolean {
  if (!value.trim()) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function timezoneOptions(): string[] {
  const preferred = COMMON_TIMEZONES.filter((zone) => TIMEZONES.includes(zone));
  const rest = TIMEZONES.filter(
    (zone) => !(COMMON_TIMEZONES as readonly string[]).includes(zone),
  );
  return [...preferred, ...rest];
}

export function resolveBranchTimezone(input: {
  restaurantTimezone: string;
  branchTimezone: string;
  useRestaurantTimezone: boolean;
}): string {
  if (input.useRestaurantTimezone) {
    return input.restaurantTimezone || "UTC";
  }
  return input.branchTimezone || input.restaurantTimezone || "UTC";
}
