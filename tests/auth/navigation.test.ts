import { describe, expect, it } from "vitest";
import {
  canAccessHref,
  filterNavByRole,
  requiredPermissionForHref,
} from "@/lib/auth/navigation";
import {
  DASHBOARD_ANALYTICS_PATH,
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_QUEUE_PATH,
  SETTINGS_BRANCHES_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_MEMBERS_PATH,
  SETTINGS_PATH,
} from "@/lib/auth/paths";
import type { MemberRole } from "@/lib/auth/roles";
import { DASHBOARD_NAV } from "@/lib/constants";

describe("navigation RBAC", () => {
  it("maps nested settings routes to the parent permission", () => {
    expect(requiredPermissionForHref(`${SETTINGS_BRANCHES_PATH}/new`)).toBe(
      "restaurant.manage",
    );
    expect(
      requiredPermissionForHref(`${SETTINGS_BRANCHES_PATH}/abc-123`),
    ).toBe("restaurant.manage");
    expect(requiredPermissionForHref(SETTINGS_GENERAL_PATH)).toBe(
      "settings.view",
    );
  });

  it("hides analytics from staff in the dashboard nav", () => {
    const staffHrefs = filterNavByRole(DASHBOARD_NAV, "STAFF").map(
      (item) => item.href,
    );
    expect(staffHrefs).not.toContain(DASHBOARD_ANALYTICS_PATH);
    expect(staffHrefs).toContain(DASHBOARD_QUEUE_PATH);
    expect(staffHrefs).toContain(SETTINGS_PATH);
  });

  it("shows analytics to managers", () => {
    const managerHrefs = filterNavByRole(DASHBOARD_NAV, "MANAGER").map(
      (item) => item.href,
    );
    expect(managerHrefs).toContain(DASHBOARD_ANALYTICS_PATH);
    expect(managerHrefs).toContain(DASHBOARD_CUSTOMERS_PATH);
  });

  it("restricts settings routes by role", () => {
    const cases: Array<{
      role: MemberRole;
      href: string;
      allowed: boolean;
    }> = [
      { role: "STAFF", href: SETTINGS_MEMBERS_PATH, allowed: false },
      { role: "MANAGER", href: SETTINGS_MEMBERS_PATH, allowed: true },
      { role: "STAFF", href: SETTINGS_BRANCHES_PATH, allowed: false },
      { role: "MANAGER", href: SETTINGS_BRANCHES_PATH, allowed: false },
      { role: "ADMIN", href: SETTINGS_BRANCHES_PATH, allowed: true },
      { role: "STAFF", href: SETTINGS_GENERAL_PATH, allowed: true },
      { role: "MANAGER", href: SETTINGS_GENERAL_PATH, allowed: true },
      { role: "OWNER", href: SETTINGS_MEMBERS_PATH, allowed: true },
    ];

    for (const { role, href, allowed } of cases) {
      expect(canAccessHref(role, href)).toBe(allowed);
    }
  });

  it("denies access when role is missing", () => {
    expect(canAccessHref(null, DASHBOARD_QUEUE_PATH)).toBe(false);
    expect(canAccessHref(undefined, SETTINGS_PATH)).toBe(false);
  });
});
