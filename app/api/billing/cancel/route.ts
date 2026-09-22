import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_BILLING_PATH } from "@/lib/auth/paths";
import { billingRestaurantSchema } from "@/lib/validations/billing";
import { cancelSubscription } from "@/services/billing/billing.service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/cancel
 * Schedule cancellation at period end.
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = billingRestaurantSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid request.",
        400,
      );
    }

    const result = await cancelSubscription(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code ?? "UNKNOWN",
        result.message ?? "Unable to cancel subscription.",
        statusForActionCode(result.code ?? "UNKNOWN"),
      );
    }

    revalidatePath(SETTINGS_BILLING_PATH);
    return jsonOk(result.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to cancel subscription.", 500);
  }
}
