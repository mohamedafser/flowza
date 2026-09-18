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
import { updateSpecialHoursSchema } from "@/lib/validations/hours";
import { deleteSpecialHours, updateSpecialHours } from "@/services/hours";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string; specialHoursId: string }>;
};

/**
 * PATCH /api/restaurants/[restaurantId]/special-hours/[specialHoursId]
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { restaurantId, specialHoursId } = await context.params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = updateSpecialHoursSchema.safeParse({
      ...(typeof parsedBody.body === "object" && parsedBody.body
        ? parsedBody.body
        : {}),
      restaurantId,
      specialHoursId,
    });

    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid special hours.",
        400,
      );
    }

    const result = await updateSpecialHours(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_HOURS_PATH);
    return jsonOk({ entry: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update special hours.", 500);
  }
}

/**
 * DELETE /api/restaurants/[restaurantId]/special-hours/[specialHoursId]
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { restaurantId, specialHoursId } = await context.params;
    const result = await deleteSpecialHours(restaurantId, specialHoursId);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_HOURS_PATH);
    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to delete special hours.", 500);
  }
}
