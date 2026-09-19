import { slugSchema } from "@/lib/validations/restaurant";

export const PUBLIC_QUEUE_ROOT = "/queue";
export const PUBLIC_QUEUE_API_ROOT = "/api/public";

export const PUBLIC_QUEUE_ACCESS_TOKEN_MIN = 32;
export const PUBLIC_QUEUE_ACCESS_TOKEN_MAX = 64;
export const PUBLIC_QUEUE_ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export const PUBLIC_QUEUE_POLL_INTERVAL_MS = 8_000;
export const PUBLIC_QUEUE_FALLBACK_INTERVAL_MS = 30_000;

export const PUBLIC_QUEUE_SESSION_KEY = "flowza-public-queue-access";

export function publicQueuePath(
  restaurantSlug: string,
  branchSlug: string,
): string {
  return `${PUBLIC_QUEUE_ROOT}/${encodeURIComponent(restaurantSlug)}/${encodeURIComponent(branchSlug)}`;
}

export function publicQueueJoinPath(
  restaurantSlug: string,
  branchSlug: string,
): string {
  return `${publicQueuePath(restaurantSlug, branchSlug)}/join`;
}

export function publicQueueStatusPath(
  restaurantSlug: string,
  branchSlug: string,
  accessToken: string,
): string {
  return `${publicQueuePath(restaurantSlug, branchSlug)}/status/${encodeURIComponent(accessToken)}`;
}

export function publicQueueInfoApiPath(
  restaurantSlug: string,
  branchSlug: string,
): string {
  return `${PUBLIC_QUEUE_API_ROOT}/branches/${encodeURIComponent(restaurantSlug)}/${encodeURIComponent(branchSlug)}/queue`;
}

export function publicQueueJoinApiPath(
  restaurantSlug: string,
  branchSlug: string,
): string {
  return `${publicQueueInfoApiPath(restaurantSlug, branchSlug)}/join`;
}

export function publicQueueSearchApiPath(
  restaurantSlug: string,
  branchSlug: string,
): string {
  return `${publicQueueInfoApiPath(restaurantSlug, branchSlug)}/customers`;
}

export function publicQueueStatusApiPath(accessToken: string): string {
  return `${PUBLIC_QUEUE_API_ROOT}/queue/${encodeURIComponent(accessToken)}`;
}

export function publicQueueCancelApiPath(accessToken: string): string {
  return `${publicQueueStatusApiPath(accessToken)}/cancel`;
}

export function isPublicQueuePath(pathname: string): boolean {
  return (
    pathname === PUBLIC_QUEUE_ROOT ||
    pathname.startsWith(`${PUBLIC_QUEUE_ROOT}/`) ||
    pathname.startsWith(`${PUBLIC_QUEUE_API_ROOT}/`)
  );
}

export function isValidPublicAccessToken(value: string): boolean {
  return (
    value.length >= PUBLIC_QUEUE_ACCESS_TOKEN_MIN &&
    value.length <= PUBLIC_QUEUE_ACCESS_TOKEN_MAX &&
    PUBLIC_QUEUE_ACCESS_TOKEN_PATTERN.test(value)
  );
}

export function parsePublicSlug(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = slugSchema.safeParse(decodeURIComponent(value));
  return parsed.success ? parsed.data : null;
}
