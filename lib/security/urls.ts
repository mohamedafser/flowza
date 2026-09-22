import { getAppOrigin } from "@/lib/auth/paths";

/**
 * Restrict push notification click targets to same-origin app URLs.
 */
export function safeAppClickUrl(
  value: string | null | undefined,
  fallbackPath = "/",
): string {
  const origin = getAppOrigin();
  const fallback = `${origin}${fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`}`;

  if (!value || !value.trim()) {
    return fallback;
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    try {
      return new URL(trimmed, origin).toString();
    } catch {
      return fallback;
    }
  }

  try {
    const url = new URL(trimmed);
    const allowed = new URL(origin);
    if (url.origin !== allowed.origin) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}
