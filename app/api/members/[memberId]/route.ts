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
import {
  removeMemberSchema,
  updateMemberRoleSchema,
} from "@/lib/validations/member";
import { removeMember, updateMemberRole } from "@/services/members";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

function revalidateMembers() {
  revalidatePath(SETTINGS_MEMBERS_PATH);
  revalidatePath("/", "layout");
}

/**
 * PATCH /api/members/[memberId]
 * Body: `{ "role": "OWNER" | "ADMIN" | "MANAGER" | "STAFF" }`
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { memberId } = await context.params;

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const body = parsedBody.body;
    const parsed = updateMemberRoleSchema.safeParse({
      ...(body && typeof body === "object" ? body : {}),
      memberId,
    });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid role change.",
        400,
      );
    }

    const result = await updateMemberRole(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidateMembers();

    return jsonOk({ memberId: result.memberId, role: result.role });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update role.", 500);
  }
}

/**
 * DELETE /api/members/[memberId]
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { memberId } = await context.params;

    const parsed = removeMemberSchema.safeParse({ memberId });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid staff member.",
        400,
      );
    }

    const result = await removeMember(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidateMembers();

    return jsonOk({ memberId: result.memberId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to remove staff member.", 500);
  }
}
