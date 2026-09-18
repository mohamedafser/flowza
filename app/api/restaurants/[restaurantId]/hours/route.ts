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
import { updateOperatingHours } from "@/services/hours";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * PUT /api/restaurants/[restaurantId]/hours
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
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
      restaurantId,
      branchId: null,
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
    return jsonFail("UNKNOWN", "Unable to update operating hours.", 500);
  }
}
