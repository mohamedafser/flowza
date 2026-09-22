import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  statusForActionCode,
} from "@/lib/api/json";
import { DASHBOARD_QUEUE_PATH } from "@/lib/auth/paths";
import { callNextQueueEntry } from "@/services/queues";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ queueId: string }>;
};

/**
 * POST /api/queues/[queueId]/call-next
 * Call the next waiting guest. Plain JSON + HTTP status codes.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireVerifiedAuth();

    const { queueId } = await context.params;
    const result = await callNextQueueEntry(queueId);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(DASHBOARD_QUEUE_PATH);
    revalidatePath(DASHBOARD_QUEUE_PATH, "layout");
    revalidatePath("/", "layout");

    return jsonOk({ entry: result.entry });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to call next guest.", 500);
  }
}
