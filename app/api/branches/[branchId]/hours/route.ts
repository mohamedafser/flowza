import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_HOURS_PATH } from "@/lib/auth/paths";
import { weekScheduleSchema } from "@/lib/validations/hours";
import { getBranch } from "@/services/branches";
import {
  clearBranchOperatingHours,
  updateOperatingHours,
} from "@/services/hours";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ branchId: string }>;
};

/**
 * PUT /api/branches/[branchId]/hours
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { branchId } = await context.params;
    const branch = await getBranch(branchId);
    if (!branch) {
      return jsonFail("NOT_FOUND", "Branch not found.", 404);
    }

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = weekScheduleSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid operating hours.",
        400,
      );
    }

    const result = await updateOperatingHours({
      restaurantId: branch.restaurant_id,
      branchId: branch.id,
      days: parsed.data.days,
    });

    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_HOURS_PATH);
    return jsonOk({ days: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update branch hours.", 500);
  }
}

/**
 * DELETE /api/branches/[branchId]/hours
 * Remove branch override and fall back to restaurant hours.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { branchId } = await context.params;
    const branch = await getBranch(branchId);
    if (!branch) {
      return jsonFail("NOT_FOUND", "Branch not found.", 404);
    }

    const result = await clearBranchOperatingHours(
      branch.restaurant_id,
      branch.id,
    );
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_HOURS_PATH);
    return jsonOk({ cleared: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to restore restaurant hours.", 500);
  }
}
