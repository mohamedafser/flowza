import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_BILLING_PATH } from "@/lib/auth/paths";
import { verifyCheckoutSchema } from "@/lib/validations/billing";
import { verifyCheckoutPayment } from "@/services/billing/billing.service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/verify
 * Server-side payment signature verification after Razorpay checkout.
 */
export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = verifyCheckoutSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid payment details.",
        400,
      );
    }

    const result = await verifyCheckoutPayment(parsed.data);
    if (!result.ok) {
      return jsonFail(
        result.code ?? "UNKNOWN",
        result.message ?? "Unable to verify payment.",
        statusForActionCode(result.code ?? "UNKNOWN"),
        result.details,
      );
    }

    revalidatePath(SETTINGS_BILLING_PATH);
    return jsonOk(result.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to verify payment.", 500);
  }
}
