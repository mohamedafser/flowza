import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";

/**
 * Multi-tenancy isolation is enforced by Phase 2 RLS helpers:
 * auth.uid() → restaurant_members → restaurant_id.
 * This suite documents the Phase 3 authorization contract used by
 * requireRestaurantMembership / requirePermission.
 */
type Membership = {
  restaurantId: string;
  role: MemberRole;
};

function authorizeRestaurantAccess(
  memberships: Membership[],
  claimedRestaurantId: string,
) {
  return (
    memberships.find((m) => m.restaurantId === claimedRestaurantId) ?? null
  );
}

function authorizePermission(
  memberships: Membership[],
  claimedRestaurantId: string,
  permission: Parameters<typeof hasPermission>[1],
) {
  const membership = authorizeRestaurantAccess(
    memberships,
    claimedRestaurantId,
  );
  if (!membership) {
    return false;
  }
  return hasPermission(membership.role, permission);
}

describe("multi-tenant authorization contract", () => {
  const restaurantA = "11111111-1111-1111-1111-111111111111";
  const restaurantB = "22222222-2222-2222-2222-222222222222";

  it("allows access only to restaurants the user belongs to", () => {
    const memberships: Membership[] = [
      { restaurantId: restaurantA, role: "STAFF" },
    ];

    expect(authorizeRestaurantAccess(memberships, restaurantA)?.role).toBe(
      "STAFF",
    );
    expect(authorizeRestaurantAccess(memberships, restaurantB)).toBeNull();
  });

  it("never trusts a client-provided restaurant ID alone", () => {
    const clientClaimedRestaurantId = "evil-restaurant";
    const serverMemberships: Membership[] = [
      { restaurantId: "trusted-restaurant", role: "OWNER" },
    ];

    expect(
      authorizeRestaurantAccess(serverMemberships, clientClaimedRestaurantId),
    ).toBeNull();
  });

  it("blocks Restaurant A staff from Restaurant B data permissions", () => {
    const memberships: Membership[] = [
      { restaurantId: restaurantA, role: "STAFF" },
    ];

    expect(authorizePermission(memberships, restaurantA, "queue.view")).toBe(
      true,
    );
    expect(authorizePermission(memberships, restaurantB, "queue.view")).toBe(
      false,
    );
    expect(authorizePermission(memberships, restaurantB, "tables.view")).toBe(
      false,
    );
    expect(authorizePermission(memberships, restaurantB, "tables.manage")).toBe(
      false,
    );
    expect(
      authorizePermission(memberships, restaurantB, "customers.view"),
    ).toBe(false);
    expect(
      authorizePermission(memberships, restaurantB, "customers.manage"),
    ).toBe(false);
  });

  it("scopes permissions to the verified membership role", () => {
    const memberships: Membership[] = [
      { restaurantId: restaurantA, role: "MANAGER" },
      { restaurantId: restaurantB, role: "STAFF" },
    ];

    expect(authorizePermission(memberships, restaurantA, "tables.manage")).toBe(
      true,
    );
    expect(authorizePermission(memberships, restaurantB, "tables.manage")).toBe(
      true,
    );
    expect(
      authorizePermission(memberships, restaurantA, "customers.manage"),
    ).toBe(true);
    expect(
      authorizePermission(memberships, restaurantB, "customers.manage"),
    ).toBe(false);
    expect(
      authorizePermission(memberships, restaurantA, "customers.view"),
    ).toBe(true);
    expect(
      authorizePermission(memberships, restaurantB, "customers.view"),
    ).toBe(true);
    expect(
      authorizePermission(memberships, restaurantA, "members.manage"),
    ).toBe(false);
    expect(
      authorizePermission(memberships, restaurantB, "members.manage"),
    ).toBe(false);
    expect(
      authorizePermission(memberships, restaurantB, "restaurant.manage"),
    ).toBe(false);
  });
});
