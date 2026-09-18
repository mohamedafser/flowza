/**
 * Normalize optional email values for storage and duplicate matching.
 * Display names are never modified here.
 */
export function normalizeEmail(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

export function emailsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  return a !== null && b !== null && a === b;
}
