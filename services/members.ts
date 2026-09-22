import { cache } from "react";
import {
  AuthorizationError,
  requirePermission,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import {
  mapMemberRpcError,
  type MemberMutationCode,
  type MemberRpcError,
} from "@/lib/members/rpc-errors";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/auth/roles";
import type {
  OrganizationInvitation,
  OrganizationMember,
} from "@/lib/utils/members";
import type {
  InviteMemberInput,
  RemoveMemberInput,
  RevokeInvitationInput,
  UpdateMemberRoleInput,
} from "@/lib/validations/member";
import { writeAuditLog } from "@/services/audit";
import { sendInvitationEmail } from "@/services/auth/email";

export type { MemberMutationCode, OrganizationInvitation, OrganizationMember };

export type MembersBundle = {
  organizationId: string;
  currentUserId: string;
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
};

/** "ADDED" when the account already existed, "INVITED" when it is parked. */
export type InviteOutcome = "ADDED" | "INVITED";

type MemberMutationFailure = {
  ok: false;
  message: string;
  code: MemberMutationCode;
};

export type InviteMemberResult =
  | { ok: true; outcome: InviteOutcome; email: string; role: MemberRole }
  | MemberMutationFailure;

export type UpdateMemberRoleResult =
  { ok: true; memberId: string; role: MemberRole } | MemberMutationFailure;

export type RemoveMemberResult =
  { ok: true; memberId: string } | MemberMutationFailure;

export type RevokeInvitationResult =
  { ok: true; invitationId: string; email: string } | MemberMutationFailure;

/**
 * Tenant scope comes from the authenticated membership, never the request.
 */
async function requireCurrentOrganization(
  permission: "members.view" | "members.manage",
) {
  const auth = await requireVerifiedAuth();
  if (!auth.restaurant || !auth.organizationId) {
    throw new AuthorizationError(
      "NO_MEMBERSHIP",
      "You do not belong to this organization.",
    );
  }

  const context = await requirePermission(auth.restaurant.id, permission);
  return { organizationId: context.organizationId, context };
}

export const getMembersBundle = cache(async (): Promise<MembersBundle> => {
  const { organizationId, context } =
    await requireCurrentOrganization("members.view");

  const supabase = await createClient();
  const [membersResult, invitationsResult] = await Promise.all([
    supabase.rpc("list_organization_members", {
      p_organization_id: organizationId,
    }),
    supabase.rpc("list_organization_invitations", {
      p_organization_id: organizationId,
    }),
  ]);

  if (membersResult.error) {
    throw new Error("Unable to load staff.");
  }

  return {
    organizationId,
    currentUserId: context.user.id,
    members: (membersResult.data ?? []) as OrganizationMember[],
    invitations: (invitationsResult.data ?? []) as OrganizationInvitation[],
  };
});

export async function inviteMember(
  input: InviteMemberInput,
): Promise<InviteMemberResult> {
  const { organizationId, context } =
    await requireCurrentOrganization("members.manage");

  if (input.role === "OWNER" && context.role !== "OWNER") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only an owner can grant the owner role.",
    };
  }

  const restaurantId = context.restaurant?.id;
  if (restaurantId) {
    try {
      const { assertUsageLimit } = await import(
        "@/services/billing/entitlement.service"
      );
      await assertUsageLimit(restaurantId, "staff");
    } catch (error) {
      const { isSubscriptionLimitError } = await import("@/lib/billing/errors");
      if (isSubscriptionLimitError(error)) {
        return {
          ok: false,
          code: "SUBSCRIPTION_LIMIT_REACHED",
          message: error.message,
        };
      }
      throw error;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_organization_member", {
    p_organization_id: organizationId,
    p_email: input.email,
    p_role: input.role,
  });

  if (error || !data) {
    return mapMemberRpcError(error as MemberRpcError);
  }

  const added = data.outcome === "ADDED";
  const entityId = added ? data.member_id : data.invitation_id;

  if (entityId) {
    await writeAuditLog({
      restaurantId: data.restaurant_id,
      organizationId,
      userId: context.user.id,
      action: added ? "member.added" : "member.invited",
      entityType: added ? "member" : "invitation",
      entityId,
      metadata: { role: data.role, email: data.email },
    });
  }

  if (!added && data.invitation_id) {
    const restaurantName =
      context.restaurant?.name ?? context.organization?.name ?? "your team";
    const inviterName =
      context.profile?.full_name ?? context.user.email ?? null;

    // Best-effort — invitation row is already saved if delivery fails.
    await sendInvitationEmail({
      to: data.email,
      restaurantName,
      role: data.role,
      inviterName,
      invitationId: data.invitation_id,
      expiresAt: data.expires_at ?? null,
    });
  }

  return {
    ok: true,
    outcome: data.outcome,
    email: data.email,
    role: data.role,
  };
}

export async function revokeInvitation(
  input: RevokeInvitationInput,
): Promise<RevokeInvitationResult> {
  const { organizationId, context } =
    await requireCurrentOrganization("members.manage");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_organization_invitation", {
    p_invitation_id: input.invitationId,
  });

  if (error || !data) {
    return mapMemberRpcError(error as MemberRpcError);
  }

  await writeAuditLog({
    restaurantId: data.restaurant_id,
    organizationId,
    userId: context.user.id,
    action: "member.invite_revoked",
    entityType: "invitation",
    entityId: data.id,
    metadata: { role: data.role, email: data.email },
  });

  return { ok: true, invitationId: data.id, email: data.email };
}

export async function updateMemberRole(
  input: UpdateMemberRoleInput,
): Promise<UpdateMemberRoleResult> {
  const { organizationId, context } =
    await requireCurrentOrganization("members.manage");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "update_organization_member_role",
    {
      p_member_id: input.memberId,
      p_role: input.role,
    },
  );

  if (error || !data) {
    return mapMemberRpcError(error as MemberRpcError);
  }

  await writeAuditLog({
    restaurantId: data.restaurant_id,
    organizationId,
    userId: context.user.id,
    action: "member.role_updated",
    entityType: "member",
    entityId: data.id,
    metadata: { role: data.role },
  });

  return { ok: true, memberId: data.id, role: data.role };
}

export async function removeMember(
  input: RemoveMemberInput,
): Promise<RemoveMemberResult> {
  const { organizationId, context } =
    await requireCurrentOrganization("members.manage");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_organization_member", {
    p_member_id: input.memberId,
  });

  if (error || !data) {
    return mapMemberRpcError(error as MemberRpcError);
  }

  await writeAuditLog({
    restaurantId: data.restaurant_id,
    organizationId,
    userId: context.user.id,
    action: "member.removed",
    entityType: "member",
    entityId: data.id,
    metadata: { role: data.role },
  });

  return { ok: true, memberId: data.id };
}
