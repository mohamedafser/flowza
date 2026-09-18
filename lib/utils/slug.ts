/**
 * Generate a URL-safe slug from a display name.
 * Empty input falls back to `item`.
 */
export function slugify(input: string, maxLength = 80): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return base.length >= 2 ? base : "item";
}

/** Append `-2`, `-3`, … until the candidate is unique among `existing`. */
export function uniqueSlug(
  desired: string,
  existing: ReadonlySet<string> | readonly string[],
  maxLength = 80,
): string {
  const taken = new Set<string>(
    existing instanceof Set ? [...existing] : existing,
  );
  const base = slugify(desired, maxLength);
  if (!taken.has(base)) {
    return base;
  }

  for (let i = 2; i < 1000; i += 1) {
    const suffix = `-${i}`;
    const truncated = base.slice(0, Math.max(1, maxLength - suffix.length));
    const candidate = `${truncated}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base.slice(0, Math.max(1, maxLength - 9))}-${Date.now().toString(36)}`;
}
