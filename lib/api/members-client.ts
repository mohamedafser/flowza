import { JSON_ACCEPT, JSON_HEADERS, parseJsonResult } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type { MemberRole } from "@/lib/auth/roles";
import type {
  OrganizationInvitation,
  OrganizationMember,
} from "@/lib/utils/members";

export type MembersApiData = {
  organizationId: string;
  currentUserId: string;
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
};

export type InviteMemberApiData = {
  outcome: "ADDED" | "INVITED";
  email: string;
  role: MemberRole;
};

export async function listMembersRequest(): Promise<
  ActionResult<MembersApiData>
> {
  const response = await fetch("/api/members", {
    method: "GET",
    headers: JSON_ACCEPT,
    cache: "no-store",
  });
  return parseJsonResult(response);
}

export async function inviteMemberRequest(
  email: string,
  role: MemberRole,
): Promise<ActionResult<InviteMemberApiData>> {
  const response = await fetch("/api/members", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, role }),
  });
  return parseJsonResult(response);
}

export async function updateMemberRoleRequest(
  memberId: string,
  role: MemberRole,
): Promise<ActionResult<{ memberId: string; role: MemberRole }>> {
  const response = await fetch(`/api/members/${memberId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ role }),
  });
  return parseJsonResult(response);
}

export async function removeMemberRequest(
  memberId: string,
): Promise<ActionResult<{ memberId: string }>> {
  const response = await fetch(`/api/members/${memberId}`, {
    method: "DELETE",
    headers: JSON_ACCEPT,
  });
  return parseJsonResult(response);
}

export async function revokeInvitationRequest(
  invitationId: string,
): Promise<ActionResult<{ invitationId: string; email: string }>> {
  const response = await fetch(`/api/members/invitations/${invitationId}`, {
    method: "DELETE",
    headers: JSON_ACCEPT,
  });
  return parseJsonResult(response);
}
