import { describe, expect, it } from "vitest";
import {
  hasPermission,
  permissionsForRole,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";
import { MEMBER_ROLES } from "@/lib/auth/roles";

describe("role permissions", () => {
  it("defines permissions for every role", () => {
    for (const role of MEMBER_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("gives OWNER full access", () => {
    const owner = permissionsForRole("OWNER");
    expect(owner).toContain("billing.manage");
    expect(owner).toContain("restaurant.manage");
    expect(owner).toContain("members.manage");
  });

  it("restricts ADMIN from ownership-level billing manage", () => {
    expect(hasPermission("ADMIN", "billing.manage")).toBe(false);
    expect(hasPermission("ADMIN", "settings.manage")).toBe(true);
    expect(hasPermission("ADMIN", "members.manage")).toBe(true);
  });

  it("limits MANAGER to operational management", () => {
    expect(hasPermission("MANAGER", "queue.manage")).toBe(true);
    expect(hasPermission("MANAGER", "tables.manage")).toBe(true);
    expect(hasPermission("MANAGER", "members.manage")).toBe(false);
    expect(hasPermission("MANAGER", "billing.view")).toBe(false);
  });

  it("limits STAFF to day-to-day operations", () => {
    expect(hasPermission("STAFF", "queue.manage")).toBe(true);
    expect(hasPermission("STAFF", "tables.view")).toBe(true);
    expect(hasPermission("STAFF", "tables.manage")).toBe(true);
    expect(hasPermission("STAFF", "customers.view")).toBe(true);
    expect(hasPermission("STAFF", "customers.manage")).toBe(false);
    expect(hasPermission("MANAGER", "customers.manage")).toBe(true);
    expect(hasPermission("STAFF", "reservations.view")).toBe(true);
    expect(hasPermission("STAFF", "reservations.manage")).toBe(true);
    expect(hasPermission("STAFF", "analytics.view")).toBe(false);
    expect(hasPermission("MANAGER", "analytics.view")).toBe(true);
    expect(hasPermission("STAFF", "settings.manage")).toBe(false);
  });

  it("denies unauthorized permissions consistently", () => {
    const cases: Array<{ role: MemberRole; permission: Permission }> = [
      { role: "STAFF", permission: "billing.manage" },
      { role: "MANAGER", permission: "restaurant.manage" },
      { role: "ADMIN", permission: "billing.manage" },
    ];

    for (const { role, permission } of cases) {
      expect(hasPermission(role, permission)).toBe(false);
    }
  });
});
