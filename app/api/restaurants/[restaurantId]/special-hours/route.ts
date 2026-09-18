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
import { createSpecialHoursSchema } from "@/lib/validations/hours";
import { createSpecialHours } from "@/services/hours";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * POST /api/restaurants/[restaurantId]/special-hours
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = createSpecialHoursSchema.safeParse({
      ...(typeof parsedBody.body === "object" && parsedBody.body
        ? parsedBody.body
        : {}),
      restaurantId,
    });

    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid special hours.",
        400,
      );
    }

    const result = await createSpecialHours(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_HOURS_PATH);
    return jsonOk({ entry: result.data }, 201);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to add special hours.", 500);
  }
}
