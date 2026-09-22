import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
} from "@/lib/api/json";
import { queueBundleQuerySchema } from "@/lib/validations/queue";
import { getQueueBundle } from "@/services/queues";

export const dynamic = "force-dynamic";

/**
 * GET /api/queues/bundle?branchId=&queueId=
 * Live queue board payload as plain JSON.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = queueBundleQuerySchema.safeParse({
      branchId: url.searchParams.get("branchId"),
      queueId: url.searchParams.get("queueId"),
    });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue request.",
        400,
      );
    }

    const bundle = await getQueueBundle(
      parsed.data.branchId,
      parsed.data.queueId,
    );
    return jsonOk(bundle);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load the queue.", 500);
  }
}
