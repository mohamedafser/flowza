import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import {
  SETTINGS_GENERAL_PATH,
  SETTINGS_RESTAURANT_PATH,
} from "@/lib/auth/paths";
import { generalSettingsSchema } from "@/lib/validations/settings";
import { updateGeneralSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * PATCH /api/restaurants/[restaurantId]/settings/general
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = generalSettingsSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid settings.",
        400,
      );
    }

    const result = await updateGeneralSettings(restaurantId, parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath("/", "layout");

    return jsonOk({ restaurantId: result.data.restaurantId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update settings.", 500);
  }
}
