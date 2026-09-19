import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
} from "@/lib/api/json";
import {
  listStaffNotifications,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
} from "@/services/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * GET /api/notifications?restaurantId=...
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      restaurantId: url.searchParams.get("restaurantId"),
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return jsonFail("VALIDATION", "Invalid notification query.", 400);
    }

    const data = await listStaffNotifications(parsed.data);
    return jsonOk(data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load notifications.", 500);
  }
}

const mutateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_read"),
    notificationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("mark_all_read"),
    restaurantId: z.string().uuid(),
  }),
]);

/**
 * POST /api/notifications — mark read / mark all read
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = mutateSchema.safeParse(body.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }

    if (parsed.data.action === "mark_read") {
      const result = await markStaffNotificationRead(parsed.data.notificationId);
      if (!result.ok) {
        return jsonFail("NOT_FOUND", result.message, 404);
      }
      return jsonOk({ marked: true });
    }

    const result = await markAllStaffNotificationsRead(parsed.data.restaurantId);
    if (!result.ok) {
      return jsonFail("UNKNOWN", result.message, 500);
    }
    return jsonOk({ marked: result.marked });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update notifications.", 500);
  }
}
