import { JSON_HEADERS, parseJsonResult } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type {
  AddCustomerToQueueInput,
  CreateQueueInput,
} from "@/lib/validations/queue";
import type { QueueEntryRecord, QueueRecord } from "@/services/queues";

export async function createQueueRequest(
  values: CreateQueueInput,
): Promise<ActionResult<{ queue: QueueRecord }>> {
  const response = await fetch("/api/queues", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function addCustomerToQueueRequest(
  values: AddCustomerToQueueInput,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  const response = await fetch(`/api/queues/${values.queueId}/entries`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      partySize: values.partySize,
      customerId: values.customerId,
      name: values.name,
      phone: values.phone,
      email: values.email,
    }),
  });
  return parseJsonResult(response);
}
