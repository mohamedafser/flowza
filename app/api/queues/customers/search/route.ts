import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
} from "@/lib/api/json";
import { searchQueueCustomersSchema } from "@/lib/validations/queue";
import { searchQueueCustomers } from "@/services/queues";

export const dynamic = "force-dynamic";

/**
 * GET /api/queues/customers/search?query=
 * Customer quick-pick for queue / reservation forms. Plain JSON.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = searchQueueCustomersSchema.safeParse({
      query: url.searchParams.get("query") ?? "",
    });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid search.",
        400,
      );
    }

    const customers = await searchQueueCustomers(parsed.data.query);
    return jsonOk({ customers });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to search customers.", 500);
  }
}
