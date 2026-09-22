import type { SubscriptionStatus } from "@/lib/billing/types";

const ACTIVE_STATUSES = new Set<SubscriptionStatus | string>([
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "PAUSED",
]);

export function isEntitlementActive(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status);
}

export function isTerminalSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return status === "EXPIRED" || status === "CANCELLED";
}
