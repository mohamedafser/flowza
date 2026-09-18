import { getZonedDateParts } from "@/lib/utils/datetime";
import { DEFAULT_TOKEN_PAD } from "@/lib/validations/queue";

export function tokenPadWidth(startingNumber: number): number {
  const digits = String(Math.max(1, startingNumber)).length;
  return Math.max(DEFAULT_TOKEN_PAD, digits);
}

export function formatQueueToken(input: {
  prefix: string;
  number: number;
  pad?: number;
}): string {
  const prefix = input.prefix.trim().toUpperCase();
  const width = Math.max(
    input.pad ?? DEFAULT_TOKEN_PAD,
    String(input.number).length,
  );
  return `${prefix}${String(input.number).padStart(width, "0")}`;
}

export function parseTokenNumber(token: string, prefix: string): number | null {
  const normalizedPrefix = prefix.trim().toUpperCase();
  const normalizedToken = token.trim().toUpperCase();
  if (!normalizedToken.startsWith(normalizedPrefix)) {
    return null;
  }
  const numeric = normalizedToken.slice(normalizedPrefix.length);
  if (!/^\d+$/.test(numeric)) {
    return null;
  }
  const value = Number(numeric);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function nextQueueNumber(input: {
  existingNumbers: readonly number[];
  startingNumber: number;
}): number {
  const starting = Math.max(1, input.startingNumber);
  if (input.existingNumbers.length === 0) {
    return starting;
  }
  const maxExisting = Math.max(...input.existingNumbers);
  return Math.max(starting, maxExisting + 1);
}

export function nextQueueToken(input: {
  prefix: string;
  existingTokens: readonly string[];
  startingNumber: number;
}): { token: string; number: number } {
  const numbers = input.existingTokens
    .map((token) => parseTokenNumber(token, input.prefix))
    .filter((value): value is number => value !== null);
  const number = nextQueueNumber({
    existingNumbers: numbers,
    startingNumber: input.startingNumber,
  });
  return {
    number,
    token: formatQueueToken({
      prefix: input.prefix,
      number,
      pad: tokenPadWidth(input.startingNumber),
    }),
  };
}

/**
 * Calendar date for queue tokens in the branch timezone — never server local time.
 */
export function businessDateForTimezone(
  instant: Date,
  timeZone: string,
): string {
  return getZonedDateParts(instant, timeZone || "UTC").date;
}
