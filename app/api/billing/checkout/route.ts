import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { checkoutSchema } from "@/lib/validations/billing";
import { createCheckoutSession } from "@/services/billing/billing.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout
 * Start a plan checkout (Razorpay subscription or free-plan switch).
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = checkoutSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid checkout details.",
        400,
      );
    }

    const result = await createCheckoutSession(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code ?? "UNKNOWN",
        result.message ?? "Unable to start checkout.",
        statusForActionCode(result.code ?? "UNKNOWN"),
        result.details,
      );
    }

    return jsonOk(result.data, 201);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to start checkout.", 500);
  }
}
