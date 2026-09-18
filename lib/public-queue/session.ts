import { PUBLIC_QUEUE_SESSION_KEY } from "@/lib/public-queue/paths";

/**
 * Device-local recovery for the public status page.
 *
 * Stored: restaurantSlug, branchSlug, accessToken, savedAt
 * Never stored: name, phone, email, customer ids, queue entry ids
 *
 * This is a convenience for the same browser/PWA only. Losing the URL
 * cannot be recovered by SMS/email in this phase.
 */
export type PublicQueueSessionRecord = {
  restaurantSlug: string;
  branchSlug: string;
  accessToken: string;
  savedAt: string;
};

function isRecord(value: unknown): value is PublicQueueSessionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.restaurantSlug === "string" &&
    typeof record.branchSlug === "string" &&
    typeof record.accessToken === "string" &&
    typeof record.savedAt === "string" &&
    !("phone" in record) &&
    !("email" in record) &&
    !("name" in record)
  );
}

export function readPublicQueueSession(
  restaurantSlug: string,
  branchSlug: string,
): PublicQueueSessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PUBLIC_QUEUE_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (
      parsed.restaurantSlug !== restaurantSlug ||
      parsed.branchSlug !== branchSlug
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePublicQueueSession(input: {
  restaurantSlug: string;
  branchSlug: string;
  accessToken: string;
}): void {
  if (typeof window === "undefined") return;
  const record: PublicQueueSessionRecord = {
    restaurantSlug: input.restaurantSlug,
    branchSlug: input.branchSlug,
    accessToken: input.accessToken,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(PUBLIC_QUEUE_SESSION_KEY, JSON.stringify(record));
}

export function clearPublicQueueSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PUBLIC_QUEUE_SESSION_KEY);
}
