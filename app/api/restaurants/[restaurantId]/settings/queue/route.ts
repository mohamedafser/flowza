import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_QUEUE_PATH } from "@/lib/auth/paths";
import { queueSettingsSchema } from "@/lib/validations/settings";
import { updateQueueSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * PATCH /api/restaurants/[restaurantId]/settings/queue
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = queueSettingsSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue settings.",
        400,
      );
    }

    const result = await updateQueueSettings(restaurantId, parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_QUEUE_PATH);
    return jsonOk({ settings: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update queue settings.", 500);
  }
}
