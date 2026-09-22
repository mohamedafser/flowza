import {
  JSON_ACCEPT,
  JSON_HEADERS,
  parseJsonResult,
  toSearchParams,
} from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type {
  AddCustomerToQueueInput,
  CreateQueueInput,
  QueueEntryActionInput,
  UpdateQueueInput,
  UpdateQueueStatusInput,
} from "@/lib/validations/queue";
import type {
  QueueBundle,
  QueueCustomerSearchResult,
  QueueEntryRecord,
  QueueRecord,
} from "@/services/queues";

export async function getQueueBundleRequest(
  branchId: string,
  queueId?: string | null,
): Promise<ActionResult<QueueBundle>> {
  const qs = toSearchParams({ branchId, queueId });
  const response = await fetch(`/api/queues/bundle?${qs}`, {
    method: "GET",
    headers: JSON_ACCEPT,
    cache: "no-store",
  });
  return parseJsonResult(response);
}

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

export async function updateQueueRequest(
  values: UpdateQueueInput,
): Promise<ActionResult<{ queue: QueueRecord }>> {
  const response = await fetch(`/api/queues/${values.queueId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function updateQueueStatusRequest(
  values: UpdateQueueStatusInput,
): Promise<ActionResult<{ queue: QueueRecord }>> {
  const response = await fetch(`/api/queues/${values.queueId}/status`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ status: values.status }),
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

export async function callNextQueueEntryRequest(
  queueId: string,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  const response = await fetch(`/api/queues/${queueId}/call-next`, {
    method: "POST",
    headers: JSON_ACCEPT,
  });
  return parseJsonResult(response);
}

async function queueEntryActionRequest(
  entryId: string,
  body: QueueEntryActionInput,
): Promise<ActionResult<{ entry: QueueEntryRecord }>> {
  const response = await fetch(`/api/queues/entries/${entryId}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return parseJsonResult(response);
}

export function callQueueEntryRequest(entryId: string) {
  return queueEntryActionRequest(entryId, { action: "call" });
}

export function skipQueueEntryRequest(entryId: string) {
  return queueEntryActionRequest(entryId, { action: "skip" });
}

export function cancelQueueEntryRequest(entryId: string) {
  return queueEntryActionRequest(entryId, { action: "cancel" });
}

export function markQueueEntryNoShowRequest(entryId: string) {
  return queueEntryActionRequest(entryId, { action: "no_show" });
}

export function completeQueueEntryRequest(entryId: string) {
  return queueEntryActionRequest(entryId, { action: "complete" });
}

export function seatQueueEntryRequest(entryId: string, tableId: string) {
  return queueEntryActionRequest(entryId, { action: "seat", tableId });
}

export async function searchQueueCustomersRequest(
  query: string,
): Promise<ActionResult<{ customers: QueueCustomerSearchResult[] }>> {
  const qs = toSearchParams({ query });
  const response = await fetch(`/api/queues/customers/search?${qs}`, {
    method: "GET",
    headers: JSON_ACCEPT,
    cache: "no-store",
  });
  return parseJsonResult(response);
}
