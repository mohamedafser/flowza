/**
 * International phone helpers for restaurant customer records.
 * Does not assume a home country — never injects a default calling code.
 */

const PHONE_MAX_DIGITS = 15;
const PHONE_MIN_DIGITS = 7;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Trim and strip common separators while preserving a leading country-code +.
 * Returns null for blank input. Does not invent or drop a country code.
 */
export function normalizePhone(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasPlus = trimmed.startsWith("+");
  const digits = digitsOnly(trimmed);
  if (!digits) {
    return null;
  }

  return hasPlus ? `+${digits}` : digits;
}

export function isValidNormalizedPhone(value: string): boolean {
  if (value.startsWith("+")) {
    return /^\+[1-9]\d{6,14}$/.test(value);
  }
  return /^\d{7,15}$/.test(value);
}

export function isValidPhoneInput(value: string): boolean {
  const normalized = normalizePhone(value);
  return normalized !== null && isValidNormalizedPhone(normalized);
}

export function phonesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return a !== null && b !== null && a === b;
}

export function phoneSearchDigits(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return digitsOnly(value);
}

export { PHONE_MAX_DIGITS, PHONE_MIN_DIGITS };
