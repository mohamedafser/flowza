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
  createReservationSchema,
  firstZodMessage,
  reservationListQuerySchema,
} from "@/lib/validations/reservation";
import {
  createReservation,
  getReservationsBundle,
  type ReservationMutationCode,
} from "@/services/reservations";

export const dynamic = "force-dynamic";

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
 * GET /api/reservations?branchId=&view=&date=&status=&search=&page=
 * List reservations for a branch (plain JSON).
 */
export async function GET(request: Request) {
  try {
    await requireVerifiedAuth();

    const url = new URL(request.url);
    const parsed = reservationListQuerySchema.safeParse({
      branchId: url.searchParams.get("branchId"),
      view: url.searchParams.get("view") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation query."),
        400,
      );
    }

    const { branchId, ...query } = parsed.data;
    const bundle = await getReservationsBundle(branchId, query);
    return jsonOk(bundle);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load reservations.", 500);
  }
}

/**
 * POST /api/reservations
 * Create a reservation (plain JSON + HTTP status).
 */
export async function POST(request: Request) {
  try {
    await requireVerifiedAuth();

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = createReservationSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid reservation details."),
        400,
      );
    }

    const result = await createReservation(parsed.data);
    if (!result.ok) {
      return jsonFail(
        mapMutationCode(result.code),
        result.message,
        statusForActionCode(mapMutationCode(result.code)),
      );
    }

    revalidateReservationPaths();
    return jsonOk({ reservation: result.reservation }, 201);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to create reservation.", 500);
  }
}
