import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
} from "@/lib/api/json";
import {
  clearBranchPreferenceCookie,
  setRestaurantPreferenceCookie,
} from "@/lib/context/restaurant";
import { getMembershipForRestaurant } from "@/lib/auth/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

/**
 * POST /api/context/restaurant
 * Set the active restaurant preference cookie.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireVerifiedAuth();

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = bodySchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid restaurant.",
        400,
      );
    }

    const membership = await getMembershipForRestaurant(
      auth.user.id,
      parsed.data.restaurantId,
    );

    if (!membership) {
      return jsonFail(
        "NO_MEMBERSHIP",
        "You do not belong to this restaurant.",
        404,
      );
    }

    await setRestaurantPreferenceCookie(parsed.data.restaurantId);
    await clearBranchPreferenceCookie();
    revalidatePath("/", "layout");

    return jsonOk({ restaurantId: parsed.data.restaurantId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to switch restaurant.", 500);
  }
}
