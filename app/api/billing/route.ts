import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
} from "@/lib/api/json";
import { getBillingOverview } from "@/services/billing/billing.service";
import { requireVerifiedAuth } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing?restaurantId=
 * Aggregated subscription, usage, plans, and payment history.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedAuth();
    const restaurantId =
      new URL(request.url).searchParams.get("restaurantId") ||
      auth.restaurant?.id;

    if (!restaurantId) {
      return jsonFail(
        "NO_MEMBERSHIP",
        "Create or select a restaurant first.",
        404,
      );
    }

    const overview = await getBillingOverview(restaurantId);
    return jsonOk({ ...overview, restaurantId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load billing details.", 500);
  }
}
