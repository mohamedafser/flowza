import { JSON_HEADERS, parseJsonResult, toSearchParams } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type {
  AssignReservationTableInput,
  ConvertReservationToQueueInput,
  CreateReservationInput,
  CreateWalkInInput,
  ReservationListQuery,
  SeatReservationInput,
  UpdateReservationInput,
} from "@/lib/validations/reservation";
import type { QueueEntryRecord } from "@/lib/utils/queue";
import type {
  ReservationBundle,
  ReservationRecord,
  ReservationWithRelations,
} from "@/services/reservations";

export async function getReservationsBundleRequest(
  query: {
    branchId: string;
    view?: ReservationListQuery["view"];
    date?: string;
    status?: ReservationListQuery["status"];
    search?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<ActionResult<ReservationBundle>> {
  const params = toSearchParams({
    branchId: query.branchId,
    view: query.view,
    date: query.date,
    status: query.status,
    search: query.search,
    page: query.page,
    pageSize: query.pageSize,
  });
  const response = await fetch(`/api/reservations?${params}`, {
    method: "GET",
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  return parseJsonResult(response);
}

export async function createReservationRequest(
  values: CreateReservationInput,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  const response = await fetch("/api/reservations", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function updateReservationRequest(
  values: UpdateReservationInput,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  const response = await fetch(`/api/reservations/${values.reservationId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function getReservationRequest(
  reservationId: string,
): Promise<ActionResult<{ reservation: ReservationWithRelations }>> {
  const response = await fetch(`/api/reservations/${reservationId}`, {
    method: "GET",
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  return parseJsonResult(response);
}

async function postReservationAction(
  reservationId: string,
  body: Record<string, unknown>,
): Promise<
  ActionResult<{
    reservation: ReservationRecord;
    entry?: QueueEntryRecord;
  }>
> {
  const response = await fetch(
    `/api/reservations/${reservationId}/actions`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    },
  );
  return parseJsonResult(response);
}

export async function confirmReservationRequest(reservationId: string) {
  return postReservationAction(reservationId, { action: "confirm" });
}

export async function cancelReservationRequest(input: {
  reservationId: string;
  reason?: string | null;
}) {
  return postReservationAction(input.reservationId, {
    action: "cancel",
    reason: input.reason ?? null,
  });
}

export async function markReservationArrivedRequest(reservationId: string) {
  return postReservationAction(reservationId, { action: "arrive" });
}

export async function assignReservationTableRequest(
  input: AssignReservationTableInput,
) {
  return postReservationAction(input.reservationId, {
    action: "assign_table",
    tableId: input.tableId,
  });
}

export async function seatReservationRequest(input: SeatReservationInput) {
  return postReservationAction(input.reservationId, {
    action: "seat",
    tableId: input.tableId,
  });
}

export async function completeReservationRequest(reservationId: string) {
  return postReservationAction(reservationId, { action: "complete" });
}

export async function markReservationNoShowRequest(reservationId: string) {
  return postReservationAction(reservationId, { action: "no_show" });
}

export async function convertReservationToQueueRequest(
  input: ConvertReservationToQueueInput,
) {
  return postReservationAction(input.reservationId, {
    action: "convert_to_queue",
    queueId: input.queueId,
  });
}

export async function createWalkInRequest(
  values: CreateWalkInInput,
): Promise<
  ActionResult<
    | {
        mode: "queue";
        entry: QueueEntryRecord;
        customerId: string;
      }
    | {
        mode: "seat";
        customerId: string;
        tableId: string;
      }
  >
> {
  const response = await fetch("/api/reservations/walk-ins", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}
