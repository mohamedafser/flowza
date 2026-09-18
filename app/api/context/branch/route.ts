import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
} from "@/lib/api/json";
import {
  setBranchPreferenceCookie,
  setRestaurantPreferenceCookie,
} from "@/lib/context/restaurant";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import { getMembershipForRestaurant } from "@/lib/auth/session";
import { getBranch } from "@/services/branches";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  branchId: z.string().uuid("Invalid branch"),
});

/**
 * POST /api/context/branch
 * Set the active branch preference cookie.
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
        parsed.error.issues[0]?.message ?? "Invalid branch.",
        400,
      );
    }

    const branch = await getBranch(parsed.data.branchId);
    if (!branch) {
      return jsonFail("NOT_FOUND", "Branch not found.", 404);
    }

    if (!branch.is_active) {
      return jsonFail(
        "FORBIDDEN",
        "Inactive branches cannot be selected for operations.",
        403,
      );
    }

    if (!auth.restaurant || branch.restaurant_id !== auth.restaurant.id) {
      const membership = await getMembershipForRestaurant(
        auth.user.id,
        branch.restaurant_id,
      );
      if (!membership) {
        return jsonFail(
          "NO_MEMBERSHIP",
          "You do not belong to this restaurant.",
          404,
        );
      }
      await setRestaurantPreferenceCookie(branch.restaurant_id);
    }

    await setBranchPreferenceCookie(branch.id);
    revalidatePath("/", "layout");
    revalidatePath(SETTINGS_BRANCHES_PATH);

    return jsonOk({ branchId: branch.id });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to switch branch.", 500);
  }
}
