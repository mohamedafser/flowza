"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionErrorCode,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_QUEUE_PATH,
  DASHBOARD_RESERVATIONS_PATH,
  DASHBOARD_TABLES_PATH,
} from "@/lib/auth/paths";
import {
  assignReservationTableSchema,
  availabilityQuerySchema,
  cancelReservationSchema,
  convertReservationToQueueSchema,
  createReservationSchema,
  createWalkInSchema,
  firstZodMessage,
  reservationIdSchema,
  reservationListQuerySchema,
  seatReservationSchema,
  updateReservationSchema,
} from "@/lib/validations/reservation";
import {
  assignReservationTable,
  cancelReservation,
  checkReservationAvailability,
  completeReservation,
  confirmReservation,
  convertReservationToQueue,
  createReservation,
  createWalkIn,
  getCustomerReservationHistory,
  getReservation,
  getReservationsBundle,
  markReservationArrived,
  markReservationNoShow,
  seatReservation,
  updateReservation,
  type ReservationBundle,
  type ReservationMutationCode,
  type ReservationRecord,
  type ReservationWithRelations,
} from "@/services/reservations";
import type { CustomerReservationHistory } from "@/lib/utils/reservations";
import type { QueueEntryRecord } from "@/lib/utils/queue";

function mapReservationCode(code: ReservationMutationCode): ActionErrorCode {
  switch (code) {
    case "OUTSIDE_HOURS":
    case "INVALID_TRANSITION":
      return "VALIDATION";
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "VALIDATION":
    case "CONFLICT":
    case "UNKNOWN":
      return code;
    default: {
      const _exhaustive: never = code;
      void _exhaustive;
      return "UNKNOWN";
    }
  }
}

function revalidateReservations() {
  revalidatePath(DASHBOARD_RESERVATIONS_PATH);
  revalidatePath(DASHBOARD_RESERVATIONS_PATH, "layout");
  revalidatePath(DASHBOARD_QUEUE_PATH);
  revalidatePath(DASHBOARD_TABLES_PATH);
  revalidatePath(DASHBOARD_CUSTOMERS_PATH);
  revalidatePath("/", "layout");
}

export async function getReservationsBundleAction(
  input: unknown,
): Promise<ActionResult<ReservationBundle>> {
  try {
    const parsed = reservationListQuerySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation request."),
      );
    }

    const { branchId, ...query } = parsed.data;
    const bundle = await getReservationsBundle(branchId, query);
    return actionOk(bundle);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to load reservations.");
  }
}

export async function getReservationAction(
  input: unknown,
): Promise<ActionResult<ReservationWithRelations>> {
  try {
    const parsed = reservationIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail("VALIDATION", "Invalid reservation.");
    }
    const reservation = await getReservation(parsed.data.reservationId);
    if (!reservation) {
      return actionFail("NOT_FOUND", "Reservation not found.");
    }
    return actionOk(reservation);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to load reservation.");
  }
}

export async function createReservationAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = createReservationSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation details."),
      );
    }

    const result = await createReservation(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }

    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create reservation.");
  }
}

export async function updateReservationAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = updateReservationSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation update."),
      );
    }

    const result = await updateReservation(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }

    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update reservation.");
  }
}

export async function confirmReservationAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = reservationIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail("VALIDATION", "Invalid reservation.");
    }
    const result = await confirmReservation(parsed.data.reservationId);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to confirm reservation.");
  }
}

export async function cancelReservationAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = cancelReservationSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid cancellation."),
      );
    }
    const result = await cancelReservation(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to cancel reservation.");
  }
}

export async function markReservationArrivedAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = reservationIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail("VALIDATION", "Invalid reservation.");
    }
    const result = await markReservationArrived(parsed.data.reservationId);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to check in reservation.");
  }
}

export async function assignReservationTableAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = assignReservationTableSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid table assignment."),
      );
    }
    const result = await assignReservationTable(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to assign table.");
  }
}

export async function seatReservationAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = seatReservationSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid seating request."),
      );
    }
    const result = await seatReservation(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to seat reservation.");
  }
}

export async function completeReservationAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = reservationIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail("VALIDATION", "Invalid reservation.");
    }
    const result = await completeReservation(parsed.data.reservationId);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to complete reservation.");
  }
}

export async function markReservationNoShowAction(
  input: unknown,
): Promise<ActionResult<{ reservation: ReservationRecord }>> {
  try {
    const parsed = reservationIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail("VALIDATION", "Invalid reservation.");
    }
    const result = await markReservationNoShow(parsed.data.reservationId);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to mark no-show.");
  }
}

export async function convertReservationToQueueAction(
  input: unknown,
): Promise<
  ActionResult<{ entry: QueueEntryRecord; reservation: ReservationRecord }>
> {
  try {
    const parsed = convertReservationToQueueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid queue conversion."),
      );
    }
    const result = await convertReservationToQueue(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    return actionOk({
      entry: result.entry,
      reservation: result.reservation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to add reservation to queue.");
  }
}

export async function createWalkInAction(
  input: unknown,
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
  try {
    const parsed = createWalkInSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid walk-in details."),
      );
    }
    const result = await createWalkIn(parsed.data);
    if (!result.ok) {
      return actionFail(mapReservationCode(result.code), result.message);
    }
    revalidateReservations();
    if (result.mode === "queue") {
      return actionOk({
        mode: "queue" as const,
        entry: result.entry,
        customerId: result.customerId,
      });
    }
    return actionOk({
      mode: "seat" as const,
      customerId: result.customerId,
      tableId: result.tableId,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create walk-in.");
  }
}

export async function checkReservationAvailabilityAction(
  input: unknown,
): Promise<
  ActionResult<{
    ok: boolean;
    issues: string[];
    message: string | null;
    suggestedTableIds: string[];
  }>
> {
  try {
    const parsed = availabilityQuerySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid availability request."),
      );
    }
    const result = await checkReservationAvailability(parsed.data);
    return actionOk(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to check availability.");
  }
}

export async function getCustomerReservationHistoryAction(
  customerId: string,
): Promise<ActionResult<CustomerReservationHistory>> {
  try {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        customerId,
      )
    ) {
      return actionFail("VALIDATION", "Invalid customer.");
    }
    const history = await getCustomerReservationHistory(customerId);
    return actionOk(history);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to load reservation history.");
  }
}
