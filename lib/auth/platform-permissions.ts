/**
 * Platform-level permissions for SaaS SUPER_ADMIN.
 * Completely separate from restaurant MemberRole permissions.
 */
export const PLATFORM_PERMISSIONS = [
  "platform.dashboard.view",
  "platform.restaurants.view",
  "platform.restaurants.manage",
  "platform.users.view",
  "platform.users.manage",
  "platform.subscriptions.view",
  "platform.subscriptions.manage",
  "platform.plans.view",
  "platform.plans.manage",
  "platform.payments.view",
  "platform.audit_logs.view",
  "platform.settings.view",
  "platform.settings.manage",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_ROLES = ["SUPER_ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** SUPER_ADMIN receives every platform permission. */
export const SUPER_ADMIN_PERMISSIONS: readonly PlatformPermission[] =
  PLATFORM_PERMISSIONS;

export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRole,
  readonly PlatformPermission[]
> = {
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
};

export function isPlatformRole(value: unknown): value is PlatformRole {
  return (
    typeof value === "string" &&
    (PLATFORM_ROLES as readonly string[]).includes(value)
  );
}

export function permissionsForPlatformRole(
  role: PlatformRole,
): readonly PlatformPermission[] {
  return PLATFORM_ROLE_PERMISSIONS[role];
}

export function hasPlatformPermission(
  role: PlatformRole | null | undefined,
  permission: PlatformPermission,
): boolean {
  if (!role) return false;
  return PLATFORM_ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPlatformPermission(
  role: PlatformRole | null | undefined,
  permissions: readonly PlatformPermission[],
): boolean {
  return permissions.some((permission) =>
    hasPlatformPermission(role, permission),
  );
}
