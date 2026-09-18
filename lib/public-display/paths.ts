import { getAppOrigin } from "@/lib/auth/paths";

export const PUBLIC_DISPLAY_ROOT = "/display";
export const PUBLIC_DISPLAY_API_ROOT = "/api/public/displays";

export const PUBLIC_DISPLAY_TOKEN_MIN = 32;
export const PUBLIC_DISPLAY_TOKEN_MAX = 64;
export const PUBLIC_DISPLAY_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Long fallback interval — realtime is primary. */
export const PUBLIC_DISPLAY_FALLBACK_INTERVAL_MS = 45_000;

export function publicDisplayPath(publicToken: string): string {
  return `${PUBLIC_DISPLAY_ROOT}/${encodeURIComponent(publicToken)}`;
}

export function publicDisplayApiPath(publicToken: string): string {
  return `${PUBLIC_DISPLAY_API_ROOT}/${encodeURIComponent(publicToken)}`;
}

export function publicDisplayAbsoluteUrl(publicToken: string): string {
  return `${getAppOrigin()}${publicDisplayPath(publicToken)}`;
}

export function isValidPublicDisplayToken(value: string): boolean {
  return (
    value.length >= PUBLIC_DISPLAY_TOKEN_MIN &&
    value.length <= PUBLIC_DISPLAY_TOKEN_MAX &&
    PUBLIC_DISPLAY_TOKEN_PATTERN.test(value)
  );
}

export function isPublicDisplayPath(pathname: string): boolean {
  return (
    pathname === PUBLIC_DISPLAY_ROOT ||
    pathname.startsWith(`${PUBLIC_DISPLAY_ROOT}/`) ||
    pathname.startsWith(`${PUBLIC_DISPLAY_API_ROOT}/`)
  );
}
