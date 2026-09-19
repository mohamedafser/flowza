/**
 * International phone helpers backed by libphonenumber-js.
 * Stored values are E.164 (e.g. +919876543210).
 */

import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "IN";

/**
 * Normalize to E.164. Returns null for blank input.
 * Accepts national numbers when a default country is provided.
 */
export function normalizePhone(
  value: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (parsed?.number) {
    return parsed.number;
  }

  // Fallback: keep leading + and digits only when the library cannot parse.
  const hasPlus = trimmed.startsWith("+");
  const digits = digitsOnly(trimmed);
  if (!digits) {
    return null;
  }
  return hasPlus ? `+${digits}` : null;
}

export function isValidNormalizedPhone(value: string): boolean {
  return isValidPhoneNumber(value);
}

export function isValidPhoneInput(
  value: string,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (isValidPhoneNumber(trimmed, defaultCountry)) {
    return true;
  }
  const normalized = normalizePhone(trimmed, defaultCountry);
  return normalized !== null && isValidPhoneNumber(normalized);
}

export function phonesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): boolean {
  const a = normalizePhone(left, defaultCountry);
  const b = normalizePhone(right, defaultCountry);
  return a !== null && b !== null && a === b;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function phoneSearchDigits(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return digitsOnly(value);
}

export function formatPhoneDisplay(
  value: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  if (!value) {
    return "";
  }
  const parsed = parsePhoneNumberFromString(value, defaultCountry);
  if (parsed) {
    return parsed.formatInternational();
  }
  return value;
}
