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
import { queueEntryActionSchema } from "@/lib/validations/queue";
import {
  callQueueEntry,
  cancelQueueEntry,
  completeQueueEntry,
  markQueueEntryNoShow,
  seatQueueEntry,
  skipQueueEntry,
} from "@/services/queues";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

/**
 * POST /api/queues/entries/[entryId]
 * Transition a queue entry (call/skip/cancel/no_show/seat/complete).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    await requireVerifiedAuth();

    const { entryId } = await context.params;
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = queueEntryActionSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue entry action.",
        400,
      );
    }

    const { action, tableId } = parsed.data;
    let result;
    switch (action) {
      case "call":
        result = await callQueueEntry(entryId);
        break;
      case "skip":
        result = await skipQueueEntry(entryId);
        break;
      case "cancel":
        result = await cancelQueueEntry(entryId);
        break;
      case "no_show":
        result = await markQueueEntryNoShow(entryId);
        break;
      case "complete":
        result = await completeQueueEntry(entryId);
        break;
      case "seat":
        result = await seatQueueEntry(entryId, tableId!);
        break;
    }

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
    return jsonFail("UNKNOWN", "Unable to update this queue entry.", 500);
  }
}
