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
import {
  restaurantFormSchema,
  toRestaurantPayload,
} from "@/lib/validations/restaurant";
import { updateRestaurant } from "@/services/restaurants";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * PATCH /api/restaurants/[restaurantId]
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = restaurantFormSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid restaurant details.",
        400,
      );
    }

    const result = await updateRestaurant(
      restaurantId,
      toRestaurantPayload(parsed.data),
    );

    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath("/", "layout");

    return jsonOk({ restaurant: result.restaurant });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update restaurant.", 500);
  }
}
