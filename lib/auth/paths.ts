export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const DASHBOARD_PATH = "/dashboard";
export const DASHBOARD_OVERVIEW_PATH = "/dashboard/overview";
export const DASHBOARD_TABLES_PATH = "/dashboard/tables";
export const DASHBOARD_CUSTOMERS_PATH = "/dashboard/customers";
export const DASHBOARD_QUEUE_PATH = "/dashboard/queue";
export const SETTINGS_PATH = "/settings";
export const SETTINGS_RESTAURANT_PATH = "/settings/restaurant";
export const SETTINGS_GENERAL_PATH = "/settings/general";
export const SETTINGS_BRANCHES_PATH = "/settings/branches";
export const SETTINGS_HOURS_PATH = "/settings/hours";
export const SETTINGS_QUEUE_PATH = "/settings/queue";
export const SETTINGS_CUSTOMER_PATH = "/settings/customer";
export const SETTINGS_TABLES_PATH = "/settings/tables";
export const DASHBOARD_DISPLAYS_PATH = "/dashboard/displays";
export const DASHBOARD_QR_CODES_PATH = "/dashboard/qr-codes";
export const ONBOARDING_PATH = "/onboarding";
export const ONBOARDING_RESTAURANT_PATH = "/onboarding/restaurant";
export const HEALTH_API_PATH = "/api/health";
export const PUBLIC_QUEUE_PATH = "/queue";
export const PUBLIC_DISPLAY_PATH = "/display";
export const PUBLIC_QR_PATH = "/qr";

/** Preference cookies only — never treat as authorization by themselves. */
export const RESTAURANT_PREFERENCE_COOKIE = "flowza_restaurant_id";
export const BRANCH_PREFERENCE_COOKIE = "flowza_branch_id";

export const AUTH_PAGE_PATHS = [
  LOGIN_PATH,
  SIGNUP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
] as const;

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === SETTINGS_PATH ||
    pathname.startsWith(`${SETTINGS_PATH}/`) ||
    pathname === DASHBOARD_PATH ||
    pathname.startsWith(`${DASHBOARD_PATH}/`) ||
    pathname === ONBOARDING_PATH ||
    pathname.startsWith(`${ONBOARDING_PATH}/`)
  );
}

export function isAuthPagePath(pathname: string): boolean {
  return (AUTH_PAGE_PATHS as readonly string[]).includes(pathname);
}

export function isPublicAuthAssetPath(pathname: string): boolean {
  return (
    pathname === HEALTH_API_PATH ||
    pathname.startsWith(AUTH_CALLBACK_PATH) ||
    pathname === "/offline" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icons/") ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-") ||
    pathname === PUBLIC_QUEUE_PATH ||
    pathname.startsWith(`${PUBLIC_QUEUE_PATH}/`) ||
    pathname === PUBLIC_DISPLAY_PATH ||
    pathname.startsWith(`${PUBLIC_DISPLAY_PATH}/`) ||
    pathname === PUBLIC_QR_PATH ||
    pathname.startsWith(`${PUBLIC_QR_PATH}/`) ||
    pathname.startsWith("/api/public/")
  );
}

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = DASHBOARD_OVERVIEW_PATH,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.startsWith("/auth/callback")) {
    return fallback;
  }
  return value;
}

export function getAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3002"
  );
}

export function authCallbackUrl(next?: string): string {
  const origin = getAppOrigin();
  const params = new URLSearchParams();
  if (next) {
    params.set("next", next);
  }
  const query = params.toString();
  return `${origin}${AUTH_CALLBACK_PATH}${query ? `?${query}` : ""}`;
}
