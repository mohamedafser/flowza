import { describe, expect, it } from "vitest";
import {
  assignableRolesForMember,
  assignableRolesForNewMember,
  canEditMember,
  canManageMembers,
  canRemoveMember,
  canViewMembers,
  countActiveOwners,
  isInvitationExpired,
  memberDisplayName,
  type OrganizationMember,
} from "@/lib/utils/members";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const STAFF_ID = "33333333-3333-4333-8333-333333333333";

function member(
  overrides: Partial<OrganizationMember> = {},
): OrganizationMember {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: STAFF_ID,
    organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    restaurant_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    role: "STAFF",
    status: "ACTIVE",
    full_name: "Sam Staff",
    email: "sam@example.com",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("member role visibility", () => {
  it("lets owners, admins, and managers view staff but not staff", () => {
    expect(canViewMembers("OWNER")).toBe(true);
    expect(canViewMembers("ADMIN")).toBe(true);
    expect(canViewMembers("MANAGER")).toBe(true);
    expect(canViewMembers("STAFF")).toBe(false);
  });

  it("limits management to owners and admins", () => {
    expect(canManageMembers("OWNER")).toBe(true);
    expect(canManageMembers("ADMIN")).toBe(true);
    expect(canManageMembers("MANAGER")).toBe(false);
    expect(canManageMembers("STAFF")).toBe(false);
  });
});

describe("assignable roles", () => {
  it("only offers the owner role to owners", () => {
    expect(assignableRolesForNewMember("OWNER")).toContain("OWNER");
    expect(assignableRolesForNewMember("ADMIN")).not.toContain("OWNER");
    expect(assignableRolesForNewMember("MANAGER")).toHaveLength(0);
  });

  it("locks the role of the last remaining owner", () => {
    const target = member({ user_id: OWNER_ID, role: "OWNER" });
    expect(
      assignableRolesForMember({
        actorRole: "OWNER",
        actorUserId: ADMIN_ID,
        member: target,
        ownerCount: 1,
      }),
    ).toEqual(["OWNER"]);
  });

  it("allows demoting an owner once a second owner exists", () => {
    const target = member({ user_id: OWNER_ID, role: "OWNER" });
    expect(
      assignableRolesForMember({
        actorRole: "OWNER",
        actorUserId: ADMIN_ID,
        member: target,
        ownerCount: 2,
      }),
    ).toContain("STAFF");
  });

  it("stops an admin from touching owner access", () => {
    const target = member({ user_id: OWNER_ID, role: "OWNER" });
    expect(
      canEditMember({
        actorRole: "ADMIN",
        actorUserId: ADMIN_ID,
        member: target,
      }),
    ).toBe(false);
  });

  it("stops anyone from changing their own role", () => {
    const target = member({ user_id: ADMIN_ID, role: "ADMIN" });
    expect(
      canEditMember({
        actorRole: "ADMIN",
        actorUserId: ADMIN_ID,
        member: target,
      }),
    ).toBe(false);
  });
});

describe("removing members", () => {
  it("allows an admin to remove staff", () => {
    expect(
      canRemoveMember({
        actorRole: "ADMIN",
        actorUserId: ADMIN_ID,
        member: member(),
        ownerCount: 1,
      }),
    ).toBe(true);
  });

  it("refuses to remove the last owner", () => {
    expect(
      canRemoveMember({
        actorRole: "OWNER",
        actorUserId: ADMIN_ID,
        member: member({ user_id: OWNER_ID, role: "OWNER" }),
        ownerCount: 1,
      }),
    ).toBe(false);
  });

  it("refuses self-removal", () => {
    expect(
      canRemoveMember({
        actorRole: "OWNER",
        actorUserId: OWNER_ID,
        member: member({ user_id: OWNER_ID, role: "OWNER" }),
        ownerCount: 2,
      }),
    ).toBe(false);
  });
});

describe("member display helpers", () => {
  it("counts only active owners", () => {
    expect(
      countActiveOwners([
        member({ role: "OWNER", status: "ACTIVE" }),
        member({ role: "OWNER", status: "SUSPENDED" }),
        member({ role: "ADMIN", status: "ACTIVE" }),
      ]),
    ).toBe(1);
  });

  it("falls back to email when the profile has no name", () => {
    expect(memberDisplayName(member({ full_name: "  " }))).toBe(
      "sam@example.com",
    );
  });
});

describe("pending invitations", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");

  it("treats a future expiry as live", () => {
    expect(
      isInvitationExpired({ expires_at: "2026-10-05T12:00:00.000Z" }, now),
    ).toBe(false);
  });

  it("treats a past expiry as expired", () => {
    expect(
      isInvitationExpired({ expires_at: "2026-09-20T12:00:00.000Z" }, now),
    ).toBe(true);
  });

  it("does not flag an unparseable expiry as expired", () => {
    expect(isInvitationExpired({ expires_at: "not-a-date" }, now)).toBe(false);
  });
});
