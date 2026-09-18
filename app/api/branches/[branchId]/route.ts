import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import {
  branchFieldsSchema,
  setBranchStatusSchema,
  toBranchPayload,
} from "@/lib/validations/branch";
import { getBranch, setBranchStatus, updateBranch } from "@/services/branches";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ branchId: string }>;
};

/**
 * GET /api/branches/[branchId]
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { branchId } = await context.params;
    const branch = await getBranch(branchId);

    if (!branch) {
      return jsonFail("NOT_FOUND", "Branch not found.", 404);
    }

    return jsonOk({ branch });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load branch.", 500);
  }
}

/**
 * PATCH /api/branches/[branchId]
 * Body either:
 * - `{ "isActive": true | false }` for status toggle
 * - full branch fields for update
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { branchId } = await context.params;

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const body = parsedBody.body;
    const isStatusOnly =
      body !== null &&
      typeof body === "object" &&
      "isActive" in body &&
      Object.keys(body as object).every((key) => key === "isActive");

    if (isStatusOnly) {
      const parsed = setBranchStatusSchema.safeParse({
        ...(body as object),
        branchId,
      });
      if (!parsed.success) {
        return jsonFail(
          "VALIDATION",
          parsed.error.issues[0]?.message ?? "Invalid branch status.",
          400,
        );
      }

      const result = await setBranchStatus(parsed.data);
      if (!result.ok) {
        return jsonFail(
          result.code,
          result.message,
          statusForActionCode(result.code),
        );
      }

      revalidatePath(SETTINGS_BRANCHES_PATH);
      revalidatePath(`${SETTINGS_BRANCHES_PATH}/${branchId}`);
      revalidatePath("/", "layout");

      return jsonOk({ branch: result.branch });
    }

    const parsed = branchFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid branch details.",
        400,
      );
    }

    const result = await updateBranch({
      branchId,
      ...toBranchPayload(parsed.data),
    });

    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_BRANCHES_PATH);
    revalidatePath(`${SETTINGS_BRANCHES_PATH}/${branchId}`);
    revalidatePath("/", "layout");

    return jsonOk({ branch: result.branch });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update branch.", 500);
  }
}
