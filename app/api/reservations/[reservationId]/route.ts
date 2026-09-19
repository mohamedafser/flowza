import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import {
  DASHBOARD_CUSTOMERS_PATH,
  DASHBOARD_QUEUE_PATH,
  DASHBOARD_RESERVATIONS_PATH,
  DASHBOARD_TABLES_PATH,
} from "@/lib/auth/paths";
import type { ActionErrorCode } from "@/lib/errors/action";
import {
  firstZodMessage,
  updateReservationSchema,
} from "@/lib/validations/reservation";
import {
  getReservation,
  updateReservation,
  type ReservationMutationCode,
} from "@/services/reservations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ reservationId: string }>;
};

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
 * GET /api/reservations/[reservationId]
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireVerifiedAuth();
    const { reservationId } = await context.params;
    const reservation = await getReservation(reservationId);
    if (!reservation) {
      return jsonFail("NOT_FOUND", "Reservation not found.", 404);
    }
    return jsonOk({ reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load reservation.", 500);
  }
}

/**
 * PATCH /api/reservations/[reservationId]
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireVerifiedAuth();
    const { reservationId } = await context.params;

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = updateReservationSchema.safeParse({
      ...(parsedBody.body as Record<string, unknown>),
      reservationId,
    });
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation update."),
        400,
      );
    }

    const result = await updateReservation(parsed.data);
    if (!result.ok) {
      return jsonFail(
        mapMutationCode(result.code),
        result.message,
        statusForActionCode(mapMutationCode(result.code)),
      );
    }

    revalidateReservationPaths();
    return jsonOk({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to update reservation.", 500);
  }
}
