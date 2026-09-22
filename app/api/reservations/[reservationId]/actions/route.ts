import { z } from "zod";
import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { startTimer } from "@/lib/api/perf";
import {
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_QUEUE_PATH,
  DASHBOARD_RESERVATIONS_PATH,
  DASHBOARD_TABLES_PATH,
} from "@/lib/auth/paths";
import type { ActionErrorCode } from "@/lib/errors/action";
import { firstZodMessage } from "@/lib/validations/reservation";
import {
  assignReservationTable,
  cancelReservation,
  completeReservation,
  confirmReservation,
  convertReservationToQueue,
  markReservationArrived,
  markReservationNoShow,
  seatReservation,
  type ReservationMutationCode,
} from "@/services/reservations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

const reservationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal("arrive") }),
  z.object({
    action: z.literal("assign_table"),
    tableId: z.string().uuid("Select a table"),
  }),
  z.object({
    action: z.literal("seat"),
    tableId: z.string().uuid("Select a table").optional(),
  }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("no_show") }),
  z.object({
    action: z.literal("convert_to_queue"),
    queueId: z.string().uuid("Select a queue"),
  }),
]);

function mapMutationCode(code: ReservationMutationCode): ActionErrorCode {
  if (code === "OUTSIDE_HOURS" || code === "INVALID_TRANSITION") {
    return "VALIDATION";
  }
  return code;
}

function revalidateReservationPaths() {
  revalidatePath(DASHBOARD_RESERVATIONS_PATH);
  revalidatePath(DASHBOARD_RESERVATIONS_PATH, "layout");
  revalidatePath(DASHBOARD_QUEUE_PATH);
  revalidatePath(DASHBOARD_TABLES_PATH);
  revalidatePath(DASHBOARD_CUSTOMERS_PATH);
  revalidatePath("/", "layout");
}

/**
 * POST /api/reservations/[reservationId]/actions
 * Body: { action: "confirm" | "cancel" | "arrive" | ... }
 */
export async function POST(request: Request, context: RouteContext) {
  const timer = startTimer();
  try {
    const { reservationId } = await context.params;

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = reservationActionSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation action."),
        400,
      );
    }

    const body = parsed.data;
    let result;

    switch (body.action) {
      case "confirm":
        result = await timer.measure("database", () =>
          confirmReservation(reservationId),
        );
        break;
      case "cancel":
        result = await timer.measure("database", () =>
          cancelReservation({
            reservationId,
            reason: body.reason ?? null,
          }),
        );
        break;
      case "arrive":
        result = await timer.measure("database", () =>
          markReservationArrived(reservationId),
        );
        break;
      case "assign_table":
        result = await timer.measure("database", () =>
          assignReservationTable({
            reservationId,
            tableId: body.tableId,
          }),
        );
        break;
      case "seat":
        result = await timer.measure("database", () =>
          seatReservation({
            reservationId,
            tableId: body.tableId,
          }),
        );
        break;
      case "complete":
        result = await timer.measure("database", () =>
          completeReservation(reservationId),
        );
        break;
      case "no_show":
        result = await timer.measure("database", () =>
          markReservationNoShow(reservationId),
        );
        break;
      case "convert_to_queue": {
        const converted = await timer.measure("database", () =>
          convertReservationToQueue({
            reservationId,
            queueId: body.queueId,
          }),
        );
        if (!converted.ok) {
          timer.log("POST /api/reservations/actions (error)");
          return jsonFail(
            mapMutationCode(converted.code),
            converted.message,
            statusForActionCode(mapMutationCode(converted.code)),
          );
        }
        revalidateReservationPaths();
        timer.log("POST /api/reservations/actions");
        return jsonOk({
          reservation: converted.reservation,
          entry: converted.entry,
        });
      }
      default: {
        const _exhaustive: never = body;
        void _exhaustive;
        return jsonFail("VALIDATION", "Unknown action.", 400);
      }
    }

    if (!result.ok) {
      timer.log("POST /api/reservations/actions (error)");
      return jsonFail(
        mapMutationCode(result.code),
        result.message,
        statusForActionCode(mapMutationCode(result.code)),
      );
    }

    revalidateReservationPaths();
    timer.log("POST /api/reservations/actions");
    return jsonOk({ reservation: result.reservation });
  } catch (error) {
    timer.log("POST /api/reservations/actions (error)");
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update reservation.", 500);
  }
}
