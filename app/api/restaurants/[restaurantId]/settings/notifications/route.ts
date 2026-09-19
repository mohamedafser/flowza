import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { notificationSettingsSchema } from "@/lib/validations/notifications";
import { updateNotificationSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * PATCH /api/restaurants/[restaurantId]/settings/notifications
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = notificationSettingsSchema.safeParse(body.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid notification settings.",
        400,
      );
    }

    const result = await updateNotificationSettings(restaurantId, parsed.data);
    if (!result.ok) {
      return jsonFail(result.code, result.message, statusForActionCode(result.code));
    }

    return jsonOk({ settings: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update notification settings.", 500);
  }
}
