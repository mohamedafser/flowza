import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import { MEMBER_ROLES } from "@/lib/auth/roles";

export const memberRoleSchema = z.enum(MEMBER_ROLES, {
  errorMap: () => ({ message: "Choose a role" }),
});

/**
 * organizationId is never accepted from the client — the server resolves it
 * from the authenticated membership.
 */
export const inviteMemberSchema = z.object({
  email: emailSchema.transform((value) => value.toLowerCase()),
  role: memberRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation"),
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid("Invalid staff member"),
  role: memberRoleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
  memberId: z.string().uuid("Invalid staff member"),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
