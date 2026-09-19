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
  createWalkInSchema,
  firstZodMessage,
} from "@/lib/validations/reservation";
import {
  createWalkIn,
  type ReservationMutationCode,
} from "@/services/reservations";

export const dynamic = "force-dynamic";

function mapMutationCode(code: ReservationMutationCode): ActionErrorCode {
  if (code === "OUTSIDE_HOURS" || code === "INVALID_TRANSITION") {
    return "VALIDATION";
  }
  return code;
}

/**
 * POST /api/reservations/walk-ins
 * Create a walk-in (queue or direct seat). Plain JSON.
 */
export async function POST(request: Request) {
  try {
    await requireVerifiedAuth();

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = createWalkInSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid walk-in details."),
        400,
      );
    }

    const result = await createWalkIn(parsed.data);
    if (!result.ok) {
      return jsonFail(
        mapMutationCode(result.code),
        result.message,
        statusForActionCode(mapMutationCode(result.code)),
      );
    }

    revalidatePath(DASHBOARD_RESERVATIONS_PATH);
    revalidatePath(DASHBOARD_QUEUE_PATH);
    revalidatePath(DASHBOARD_TABLES_PATH);
    revalidatePath(DASHBOARD_CUSTOMERS_PATH);
    revalidatePath("/", "layout");

    if (result.mode === "queue") {
      return jsonOk(
        {
          mode: "queue" as const,
          entry: result.entry,
          customerId: result.customerId,
        },
        201,
      );
    }

    return jsonOk(
      {
        mode: "seat" as const,
        customerId: result.customerId,
        tableId: result.tableId,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to create walk-in.", 500);
  }
}
