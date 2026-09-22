import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_MEMBERS_PATH } from "@/lib/auth/paths";
import { revokeInvitationSchema } from "@/lib/validations/member";
import { revokeInvitation } from "@/services/members";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ invitationId: string }>;
};

/**
 * DELETE /api/members/invitations/[invitationId]
 * Revokes a pending invitation.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { invitationId } = await context.params;

    const parsed = revokeInvitationSchema.safeParse({ invitationId });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid invitation.",
        400,
      );
    }

    const result = await revokeInvitation(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_MEMBERS_PATH);
    revalidatePath("/", "layout");

    return jsonOk({ invitationId: result.invitationId, email: result.email });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to revoke invitation.", 500);
  }
}
