import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { DASHBOARD_OVERVIEW_PATH } from "@/lib/auth/paths";
import {
  clearBranchPreferenceCookie,
  setRestaurantPreferenceCookie,
} from "@/lib/context/restaurant";
import {
  restaurantOnboardingSchema,
  toRestaurantPayload,
} from "@/lib/validations/restaurant";
import { createRestaurant } from "@/services/restaurants";

export const dynamic = "force-dynamic";

/**
 * POST /api/restaurants
 * Creates a restaurant + OWNER membership. Plain JSON only.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireVerifiedAuth();

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = restaurantOnboardingSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid restaurant details.",
        400,
      );
    }

    const result = await createRestaurant(
      auth.user.id,
      toRestaurantPayload(parsed.data),
    );

    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    await setRestaurantPreferenceCookie(result.restaurant.id);
    await clearBranchPreferenceCookie();
    revalidatePath("/", "layout");

    return jsonOk(
      {
        restaurantId: result.restaurant.id,
        redirectTo: DASHBOARD_OVERVIEW_PATH,
      },
      result.alreadyExisted ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail(
      "UNKNOWN",
      "Unable to create restaurant. Please try again.",
      500,
    );
  }
}
