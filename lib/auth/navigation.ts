import {
  DASHBOARD_ANALYTICS_PATH,
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_DISPLAYS_PATH,
  DASHBOARD_OVERVIEW_PATH,
  DASHBOARD_QR_CODES_PATH,
  DASHBOARD_QUEUE_PATH,
  DASHBOARD_RESERVATIONS_PATH,
  DASHBOARD_TABLES_PATH,
  SETTINGS_BRANCHES_PATH,
  SETTINGS_CUSTOMER_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_HOURS_PATH,
  SETTINGS_MEMBERS_PATH,
  SETTINGS_NOTIFICATIONS_PATH,
  SETTINGS_PATH,
  SETTINGS_QUEUE_PATH,
  SETTINGS_RESTAURANT_PATH,
  SETTINGS_TABLES_PATH,
  SETTINGS_BILLING_PATH,
} from "@/lib/auth/paths";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";

/**
 * Permission required to open each primary app route.
 * Kept in sync with ROLE_PERMISSIONS and MEMBER_ROLE_MATRIX.
 */
const ROUTE_PERMISSIONS: ReadonlyArray<readonly [string, Permission]> = [
  [DASHBOARD_OVERVIEW_PATH, "restaurant.view"],
  [DASHBOARD_QUEUE_PATH, "queue.view"],
  [DASHBOARD_TABLES_PATH, "tables.view"],
  [DASHBOARD_CUSTOMERS_PATH, "customers.view"],
  [DASHBOARD_RESERVATIONS_PATH, "reservations.view"],
  [DASHBOARD_DISPLAYS_PATH, "displays.view"],
  [DASHBOARD_QR_CODES_PATH, "qr_codes.view"],
  [DASHBOARD_ANALYTICS_PATH, "analytics.view"],
  // Branches are owner/admin configuration — not visible to managers/staff.
  [SETTINGS_BRANCHES_PATH, "restaurant.manage"],
  [SETTINGS_MEMBERS_PATH, "members.view"],
  [SETTINGS_TABLES_PATH, "tables.view"],
  [SETTINGS_GENERAL_PATH, "settings.view"],
  [SETTINGS_HOURS_PATH, "settings.view"],
  [SETTINGS_QUEUE_PATH, "settings.view"],
  [SETTINGS_CUSTOMER_PATH, "settings.view"],
  [SETTINGS_NOTIFICATIONS_PATH, "settings.view"],
  [SETTINGS_RESTAURANT_PATH, "settings.view"],
  [SETTINGS_BILLING_PATH, "billing.view"],
  [SETTINGS_PATH, "settings.view"],
];

/** Longest-prefix match so nested routes inherit the parent permission. */
export function requiredPermissionForHref(href: string): Permission | null {
  const path = href.split("?")[0] ?? href;
  let best: { route: string; permission: Permission } | null = null;

  for (const [route, permission] of ROUTE_PERMISSIONS) {
    if (path === route || path.startsWith(`${route}/`)) {
      if (!best || route.length > best.route.length) {
        best = { route, permission };
      }
    }
  }

  return best?.permission ?? null;
}

export function canAccessHref(
  role: MemberRole | null | undefined,
  href: string,
): boolean {
  if (!role) return false;
  const permission = requiredPermissionForHref(href);
  if (!permission) return true;
  return hasPermission(role, permission);
}

export function filterNavByRole<T extends { href: string }>(
  items: readonly T[],
  role: MemberRole | null | undefined,
): T[] {
  if (!role) return [...items];
  return items.filter((item) => canAccessHref(role, item.href));
}
