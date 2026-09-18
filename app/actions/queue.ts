"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_QUEUE_PATH,
} from "@/lib/auth/paths";
import {
  addCustomerToQueueSchema,
  callNextQueueSchema,
  callQueueEntrySchema,
  cancelQueueEntrySchema,
  completeQueueEntrySchema,
  createQueueSchema,
  noShowQueueEntrySchema,
  queueBundleQuerySchema,
  searchQueueCustomersSchema,
  seatQueueEntrySchema,
  skipQueueEntrySchema,
  updateQueueSchema,
  updateQueueStatusSchema,
} from "@/lib/validations/queue";
import {
  addCustomerToQueue,
  callNextQueueEntry,
  callQueueEntry,
  cancelQueueEntry,
  completeQueueEntry,
  createQueue,
  getQueueBundle,
  markQueueEntryNoShow,
  searchQueueCustomers,
  seatQueueEntry,
  skipQueueEntry,
  updateQueue,
  updateQueueStatus,
  type QueueBundle,
  type QueueCustomerSearchResult,
  type QueueEntryRecord,
  type QueueRecord,
} from "@/services/queues";

function revalidateQueue() {
  revalidatePath(DASHBOARD_QUEUE_PATH);
  revalidatePath(DASHBOARD_QUEUE_PATH, "layout");
  revalidatePath(DASHBOARD_CUSTOMERS_PATH);
  revalidatePath(DASHBOARD_CUSTOMERS_PATH, "layout");
  revalidatePath("/", "layout");
}

export async function getQueueBundleAction(
  input: unknown,
): Promise<ActionResult<QueueBundle>> {
  try {
    const parsed = queueBundleQuerySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue request.",
      );
    }

    const bundle = await getQueueBundle(
      parsed.data.branchId,
      parsed.data.queueId,
    );
    return actionOk(bundle);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to load the queue.");
  }
}

export async function createQueueAction(
  input: unknown,
): Promise<ActionResult<{ queue: QueueRecord }>> {
  try {
    const parsed = createQueueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue details.",
      );
    }

    const result = await createQueue(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateQueue();
    return actionOk({ queue: result.queue });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create queue.");
  }
}

export async function updateQueueAction(
  input: unknown,
): Promise<ActionResult<{ queue: QueueRecord }>> {
  try {
    const parsed = updateQueueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue details.",
      );
    }

    const result = await updateQueue(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateQueue();
    return actionOk({ queue: result.queue });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update queue.");
  }
}

export async function updateQueueStatusAction(
  input: unknown,
): Promise<ActionResult<{ queue: QueueRecord }>> {
  try {
    const parsed = updateQueueStatusSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue status.",
      );
    }

    const result = await updateQueueStatus(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateQueue();
    return actionOk({ queue: result.queue });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update queue status.");
  }
}

export async function addCustomerToQueueAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  try {
    const parsed = addCustomerToQueueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue entry.",
      );
    }

    const result = await addCustomerToQueue(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateQueue();
    return actionOk({ entry: result.entry });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to add customer to the queue.");
  }
}

export async function callNextQueueEntryAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  try {
    const parsed = callNextQueueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue.",
      );
    }

    const result = await callNextQueueEntry(parsed.data.queueId);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateQueue();
    return actionOk({ entry: result.entry });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to call the next customer.");
  }
}

async function runEntryAction(
  schema:
    | typeof callQueueEntrySchema
    | typeof skipQueueEntrySchema
    | typeof cancelQueueEntrySchema
    | typeof noShowQueueEntrySchema
    | typeof completeQueueEntrySchema,
  input: unknown,
  run: (
    entryId: string,
  ) => Promise<
    | { ok: true; entry: QueueEntryRecord }
    | { ok: false; message: string; code: string }
  >,
  fallback: string,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue entry.",
      );
    }

    const result = await run(parsed.data.entryId);
    if (!result.ok) {
      return actionFail(
        result.code as
          "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "UNKNOWN",
        result.message,
      );
    }

    revalidateQueue();
    return actionOk({ entry: result.entry });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, fallback);
  }
}

export async function callQueueEntryAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  return runEntryAction(
    callQueueEntrySchema,
    input,
    callQueueEntry,
    "Unable to call this customer.",
  );
}

export async function skipQueueEntryAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  return runEntryAction(
    skipQueueEntrySchema,
    input,
    skipQueueEntry,
    "Unable to skip this customer.",
  );
}

export async function cancelQueueEntryAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  return runEntryAction(
    cancelQueueEntrySchema,
    input,
    cancelQueueEntry,
    "Unable to cancel this customer.",
  );
}

export async function markQueueEntryNoShowAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  return runEntryAction(
    noShowQueueEntrySchema,
    input,
    markQueueEntryNoShow,
    "Unable to mark this customer as no-show.",
  );
}

export async function completeQueueEntryAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  return runEntryAction(
    completeQueueEntrySchema,
    input,
    completeQueueEntry,
    "Unable to complete this visit.",
  );
}

export async function seatQueueEntryAction(
  input: unknown,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  try {
    const parsed = seatQueueEntrySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Select a table.",
      );
    }

    const result = await seatQueueEntry(
      parsed.data.entryId,
      parsed.data.tableId,
    );
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateQueue();
    return actionOk({ entry: result.entry });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to seat this customer.");
  }
}

export async function searchQueueCustomersAction(
  input: unknown,
): Promise<ActionResult<{ customers: QueueCustomerSearchResult[] }>> {
  try {
    const parsed = searchQueueCustomersSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid search.",
      );
    }

    const customers = await searchQueueCustomers(parsed.data.query);
    return actionOk({ customers });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to search customers.");
  }
}
