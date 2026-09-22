import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
} from "@/lib/api/json";
import { isWebPushConfigured } from "@/lib/notifications/push/config";
import {
  deleteStaffPushSubscription,
  pushSubscriptionSchema,
  upsertStaffPushSubscription,
} from "@/services/push";
import { z } from "zod";

export const dynamic = "force-dynamic";

const subscribeBodySchema = z.object({
  restaurantId: z.string().uuid(),
  subscription: pushSubscriptionSchema,
});

const unsubscribeBodySchema = z.object({
  endpoint: z.string().url().max(2048),
});

/** POST /api/push/subscribe — staff device opt-in */
export async function POST(request: Request) {
  if (!isWebPushConfigured()) {
    return jsonFail(
      "VALIDATION",
      "Web Push is not configured. Set VAPID keys on the server.",
      400,
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = subscribeBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid subscription.",
      400,
    );
  }

  try {
    const result = await upsertStaffPushSubscription({
      restaurantId: parsed.data.restaurantId,
      subscription: parsed.data.subscription,
      userAgent: request.headers.get("user-agent"),
    });

    if (!result.ok) {
      return jsonFail("FORBIDDEN", result.message, 403);
    }

    return jsonOk({ id: result.id });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to save push subscription.", 500);
  }
}

/** DELETE /api/push/subscribe — staff device opt-out */
export async function DELETE(request: Request) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = unsubscribeBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request.",
      400,
    );
  }

  try {
    const result = await deleteStaffPushSubscription({
      endpoint: parsed.data.endpoint,
    });
    if (!result.ok) {
      return jsonFail("UNKNOWN", result.message, 500);
    }
    return jsonOk({ removed: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to remove push subscription.", 500);
  }
}
