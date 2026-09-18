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
import { createQueueSchema } from "@/lib/validations/queue";
import { createQueue } from "@/services/queues";

export const dynamic = "force-dynamic";

/**
 * POST /api/queues
 * Create a branch queue. Plain JSON + HTTP status codes.
 */
export async function POST(request: Request) {
  try {
    await requireVerifiedAuth();

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = createQueueSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue details.",
        400,
      );
    }

    const result = await createQueue(parsed.data);
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

    return jsonOk({ queue: result.queue }, 201);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail(
      "UNKNOWN",
      "Unable to create queue. Please try again.",
      500,
    );
  }
}
