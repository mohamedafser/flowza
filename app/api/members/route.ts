import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_MEMBERS_PATH } from "@/lib/auth/paths";
import { inviteMemberSchema } from "@/lib/validations/member";
import { getMembersBundle, inviteMember } from "@/services/members";

export const dynamic = "force-dynamic";

/**
 * GET /api/members
 * Staff and pending invitations for the caller's organization.
 */
export async function GET() {
  try {
    const bundle = await getMembersBundle();
    return jsonOk({
      organizationId: bundle.organizationId,
      currentUserId: bundle.currentUserId,
      members: bundle.members,
      invitations: bundle.invitations,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load staff.", 500);
  }
}

/**
 * POST /api/members
 * Adds an existing account, or parks an invitation until they sign up.
 * `data.outcome` is "ADDED" or "INVITED".
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = inviteMemberSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid staff details.",
        400,
      );
    }

    const result = await inviteMember(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_MEMBERS_PATH);
    revalidatePath("/", "layout");

    return jsonOk(
      { outcome: result.outcome, email: result.email, role: result.role },
      201,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to add staff member.", 500);
  }
}
