import { hasPermission } from "@/lib/auth/permissions";
import { MEMBER_ROLES, type MemberRole } from "@/lib/auth/roles";
import type { StatusTone } from "@/types";
import type { Enums } from "@/types/database";

export type MemberStatus = Enums<"member_status">;

/** Organization staff row enriched with the account's profile/email. */
export type OrganizationMember = {
  id: string;
  user_id: string;
  organization_id: string;
  restaurant_id: string;
  role: MemberRole;
  status: MemberStatus;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

/** Invitation parked until the person creates a Flowza account. */
export type OrganizationInvitation = {
  id: string;
  organization_id: string;
  restaurant_id: string;
  email: string;
  role: MemberRole;
  status: Enums<"invitation_status">;
  invited_by: string | null;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const MEMBER_ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  OWNER:
    "Full control of the organization, including billing and other owners.",
  ADMIN:
    "Everything except billing changes — best for trusted managers of the business.",
  MANAGER:
    "Run day-to-day operations across customers, queues, tables, and displays.",
  STAFF: "Serve guests on the floor — queue, tables, and reservations only.",
};

/**
 * Concrete capabilities shown on the Staff & roles page.
 * Kept in sync with ROLE_PERMISSIONS in lib/auth/permissions.ts.
 */
export const MEMBER_ROLE_CAPABILITIES: Record<MemberRole, readonly string[]> = {
  OWNER: [
    "Everything an Admin can do",
    "Manage billing and subscription",
    "Add, change, or remove other Owners",
    "Delete the restaurant and organization settings",
  ],
  ADMIN: [
    "Invite and remove staff (except Owners)",
    "Change anyone’s role below Owner",
    "Edit restaurant profile, branches, hours, and settings",
    "Manage customers, queues, tables, displays, and QR codes",
    "View analytics",
    "View billing (cannot change payment methods or plan)",
  ],
  MANAGER: [
    "View the staff list (cannot invite or change roles)",
    "Manage customers, queues, tables, and reservations",
    "Manage displays and QR codes",
    "View analytics and restaurant settings",
    "Cannot edit restaurant profile, branches, or organization settings",
  ],
  STAFF: [
    "Run the live queue (seat, call, and update guests)",
    "Update table status and take walk-in reservations",
    "View customers, displays, and QR codes",
    "View settings (read-only)",
    "Cannot manage staff, branches, analytics, or billing",
  ],
};

/** Access level used in the role comparison table. */
export type RoleAccess = "full" | "view" | "none";

export const ROLE_ACCESS_LABELS: Record<RoleAccess, string> = {
  full: "Full",
  view: "View",
  none: "—",
};

export type RoleMatrixRow = {
  area: string;
  access: Record<MemberRole, RoleAccess>;
};

/**
 * Side-by-side permission matrix for the Staff & roles page.
 * Kept in sync with ROLE_PERMISSIONS in lib/auth/permissions.ts.
 */
export const MEMBER_ROLE_MATRIX: readonly RoleMatrixRow[] = [
  {
    area: "Staff & roles",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "view", STAFF: "none" },
  },
  {
    area: "Restaurant profile & branches",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "none", STAFF: "none" },
  },
  {
    area: "Settings & hours",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "view", STAFF: "view" },
  },
  {
    area: "Queues",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "full", STAFF: "full" },
  },
  {
    area: "Tables",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "full", STAFF: "full" },
  },
  {
    area: "Customers",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "full", STAFF: "view" },
  },
  {
    area: "Reservations",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "full", STAFF: "full" },
  },
  {
    area: "Displays & QR codes",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "full", STAFF: "view" },
  },
  {
    area: "Analytics",
    access: { OWNER: "full", ADMIN: "full", MANAGER: "view", STAFF: "none" },
  },
  {
    area: "Billing",
    access: { OWNER: "full", ADMIN: "view", MANAGER: "none", STAFF: "none" },
  },
];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  SUSPENDED: "Suspended",
};

export function memberStatusTone(status: MemberStatus): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "INVITED") return "info";
  return "warning";
}

export function canViewMembers(role: MemberRole): boolean {
  return hasPermission(role, "members.view");
}

export function canManageMembers(role: MemberRole): boolean {
  return hasPermission(role, "members.manage");
}

export function memberDisplayName(
  member: Pick<OrganizationMember, "full_name" | "email">,
): string {
  return member.full_name?.trim() || member.email || "Unknown member";
}

export function countActiveOwners(
  members: readonly Pick<OrganizationMember, "role" | "status">[],
): number {
  return members.filter(
    (member) => member.role === "OWNER" && member.status === "ACTIVE",
  ).length;
}

/** Only an owner may grant owner access. */
export function assignableRolesForNewMember(
  actorRole: MemberRole,
): readonly MemberRole[] {
  if (!canManageMembers(actorRole)) {
    return [];
  }
  return actorRole === "OWNER"
    ? MEMBER_ROLES
    : MEMBER_ROLES.filter((role) => role !== "OWNER");
}

type MemberActionInput = {
  actorRole: MemberRole;
  actorUserId: string;
  member: Pick<OrganizationMember, "user_id" | "role">;
  ownerCount: number;
};

/** Editing your own role would let you lock yourself out of the tenant. */
export function canEditMember(
  input: Omit<MemberActionInput, "ownerCount">,
): boolean {
  if (!canManageMembers(input.actorRole)) return false;
  if (input.member.user_id === input.actorUserId) return false;
  if (input.member.role === "OWNER" && input.actorRole !== "OWNER")
    return false;
  return true;
}

export function assignableRolesForMember(
  input: MemberActionInput,
): readonly MemberRole[] {
  if (!canEditMember(input)) {
    return [];
  }
  if (input.member.role === "OWNER" && input.ownerCount <= 1) {
    return ["OWNER"];
  }
  return assignableRolesForNewMember(input.actorRole);
}

export function canRemoveMember(input: MemberActionInput): boolean {
  if (!canEditMember(input)) return false;
  if (input.member.role === "OWNER" && input.ownerCount <= 1) return false;
  return true;
}

export function isInvitationExpired(
  invitation: Pick<OrganizationInvitation, "expires_at">,
  now: Date = new Date(),
): boolean {
  const expires = Date.parse(invitation.expires_at);
  return Number.isFinite(expires) && expires <= now.getTime();
}
