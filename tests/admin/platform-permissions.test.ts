import { describe, expect, it } from "vitest";
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
  SUPER_ADMIN_PERMISSIONS,
  hasPlatformPermission,
  isPlatformRole,
  permissionsForPlatformRole,
} from "@/lib/auth/platform-permissions";
import { ROLE_PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { isAdminPath, isProtectedPath } from "@/lib/auth/paths";
import {
  adminPlanUpsertSchema,
  adminRestaurantListSchema,
  adminRestaurantStatusSchema,
  adminSettingsUpdateSchema,
  adminUserStatusSchema,
} from "@/lib/validations/admin";

describe("platform permissions", () => {
  it("defines SUPER_ADMIN as the only platform role", () => {
    expect(PLATFORM_ROLES).toEqual(["SUPER_ADMIN"]);
    expect(isPlatformRole("SUPER_ADMIN")).toBe(true);
    expect(isPlatformRole("OWNER")).toBe(false);
    expect(isPlatformRole("ADMIN")).toBe(false);
  });

  it("gives SUPER_ADMIN every platform permission", () => {
    const perms = permissionsForPlatformRole("SUPER_ADMIN");
    expect(perms).toEqual(SUPER_ADMIN_PERMISSIONS);
    for (const permission of PLATFORM_PERMISSIONS) {
      expect(hasPlatformPermission("SUPER_ADMIN", permission)).toBe(true);
    }
  });

  it("keeps platform permissions separate from restaurant permissions", () => {
    for (const permission of PLATFORM_PERMISSIONS) {
      expect(permission.startsWith("platform.")).toBe(true);
    }

    for (const role of Object.keys(ROLE_PERMISSIONS) as Array<
      keyof typeof ROLE_PERMISSIONS
    >) {
      for (const permission of PLATFORM_PERMISSIONS) {
        // Restaurant roles must never receive platform.* via ROLE_PERMISSIONS.
        expect(
          (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission),
        ).toBe(false);
      }
      expect(hasPermission(role, "restaurant.view")).toBe(true);
    }
  });

  it("does not treat null/undefined as platform-authorized", () => {
    expect(hasPlatformPermission(null, "platform.dashboard.view")).toBe(false);
    expect(hasPlatformPermission(undefined, "platform.restaurants.manage")).toBe(
      false,
    );
  });
});

describe("admin path protection", () => {
  it("treats /admin as a protected path", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/restaurants")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/users")).toBe(true);
    expect(isAdminPath("/dashboard")).toBe(false);
  });
});

describe("admin validation", () => {
  it("accepts restaurant list query defaults", () => {
    const parsed = adminRestaurantListSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.status).toBe("ALL");
    }
  });

  it("rejects invalid restaurant status mutations", () => {
    expect(adminRestaurantStatusSchema.safeParse({ status: "DELETED" }).success).toBe(
      false,
    );
    expect(
      adminRestaurantStatusSchema.safeParse({ status: "SUSPENDED" }).success,
    ).toBe(true);
  });

  it("rejects negative plan limits and invalid codes", () => {
    const invalid = adminPlanUpsertSchema.safeParse({
      code: "starter",
      name: "Starter",
      monthlyPrice: 10,
      yearlyPrice: 100,
      currency: "INR",
      features: {},
      limits: {
        max_branches: -1,
        max_staff: 1,
        max_tables: 1,
        max_queue_entries_per_month: 1,
      },
    });
    expect(invalid.success).toBe(false);

    const valid = adminPlanUpsertSchema.safeParse({
      code: "STARTER_PLUS",
      name: "Starter Plus",
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: "inr",
      features: { analytics: true },
      limits: {
        max_branches: 1,
        max_staff: 2,
        max_tables: 3,
        max_queue_entries_per_month: 100,
      },
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.currency).toBe("INR");
    }
  });

  it("validates user account status and settings updates", () => {
    expect(
      adminUserStatusSchema.safeParse({ accountStatus: "DISABLED" }).success,
    ).toBe(true);
    expect(
      adminSettingsUpdateSchema.safeParse({
        support_email: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      adminSettingsUpdateSchema.safeParse({
        maintenance_mode: true,
        default_trial_days: 21,
      }).success,
    ).toBe(true);
  });
});
