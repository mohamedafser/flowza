import type { MemberRole } from "@/lib/auth/roles";

/**
 * Application permissions for future modules.
 * Authorization must still be enforced server-side — never trust client checks alone.
 */
export const PERMISSIONS = [
  "restaurant.view",
  "restaurant.manage",
  "members.view",
  "members.manage",
  "queue.view",
  "queue.manage",
  "tables.view",
  "tables.manage",
  "customers.view",
  "customers.manage",
  "reservations.view",
  "reservations.manage",
  "displays.view",
  "displays.manage",
  "qr_codes.view",
  "qr_codes.manage",
  "analytics.view",
  "settings.view",
  "settings.manage",
  "billing.view",
  "billing.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

const OWNER_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS;

const ADMIN_PERMISSIONS: readonly Permission[] = ALL_PERMISSIONS.filter(
  (permission) => permission !== "billing.manage",
);

const MANAGER_PERMISSIONS: readonly Permission[] = [
  "restaurant.view",
  "members.view",
  "queue.view",
  "queue.manage",
  "tables.view",
  "tables.manage",
  "customers.view",
  "customers.manage",
  "reservations.view",
  "reservations.manage",
  "displays.view",
  "displays.manage",
  "qr_codes.view",
  "qr_codes.manage",
  "analytics.view",
  "settings.view",
];

const STAFF_PERMISSIONS: readonly Permission[] = [
  "restaurant.view",
  "queue.view",
  "queue.manage",
  "tables.view",
  "tables.manage",
  "customers.view",
  "reservations.view",
  "reservations.manage",
  "displays.view",
  "qr_codes.view",
  "settings.view",
];

export const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  OWNER: OWNER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
};

export function permissionsForRole(role: MemberRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  role: MemberRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: MemberRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(
  role: MemberRole,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
