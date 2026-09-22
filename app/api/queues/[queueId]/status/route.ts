import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { DASHBOARD_QUEUE_PATH } from "@/lib/auth/paths";
import { updateQueueStatusSchema } from "@/lib/validations/queue";
import { updateQueueStatus } from "@/services/queues";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ queueId: string }>;
};

/**
 * POST /api/queues/[queueId]/status
 * Set queue ACTIVE / PAUSED / CLOSED. Plain JSON + HTTP status codes.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    await requireVerifiedAuth();

    const { queueId } = await context.params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const body =
      parsedBody.body && typeof parsedBody.body === "object"
        ? parsedBody.body
        : {};

    const parsed = updateQueueStatusSchema.safeParse({
      ...body,
      queueId,
    });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue status.",
        400,
      );
    }

    const result = await updateQueueStatus(parsed.data);
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

    return jsonOk({ queue: result.queue });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update queue status.", 500);
  }
}
