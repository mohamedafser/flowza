"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import { SETTINGS_HOURS_PATH } from "@/lib/auth/paths";
import {
  clearBranchHoursSchema,
  createSpecialHoursSchema,
  deleteSpecialHoursSchema,
  updateOperatingHoursSchema,
  updateSpecialHoursSchema,
} from "@/lib/validations/hours";
import {
  clearBranchOperatingHours,
  createSpecialHours,
  deleteSpecialHours,
  updateOperatingHours,
  updateSpecialHours,
} from "@/services/hours";
import type { SpecialHoursEntry, WeekSchedule } from "@/lib/utils/hours";

function revalidateHours() {
  revalidatePath(SETTINGS_HOURS_PATH);
}

export async function updateOperatingHoursAction(
  input: unknown,
): Promise<ActionResult<{ days: WeekSchedule }>> {
  try {
    const parsed = updateOperatingHoursSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid operating hours.",
      );
    }

    const result = await updateOperatingHours(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateHours();
    return actionOk({ days: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update operating hours.");
  }
}

export async function clearBranchHoursAction(
  input: unknown,
): Promise<ActionResult<{ cleared: true }>> {
  try {
    const parsed = clearBranchHoursSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid request.",
      );
    }

    const result = await clearBranchOperatingHours(
      parsed.data.restaurantId,
      parsed.data.branchId,
    );
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateHours();
    return actionOk(result.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to restore restaurant hours.");
  }
}

export async function createSpecialHoursAction(
  input: unknown,
): Promise<ActionResult<{ entry: SpecialHoursEntry & { id: string } }>> {
  try {
    const parsed = createSpecialHoursSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid special hours.",
      );
    }

    const result = await createSpecialHours(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateHours();
    return actionOk({ entry: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to add special hours.");
  }
}

export async function updateSpecialHoursAction(
  input: unknown,
): Promise<ActionResult<{ entry: SpecialHoursEntry & { id: string } }>> {
  try {
    const parsed = updateSpecialHoursSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid special hours.",
      );
    }

    const result = await updateSpecialHours(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateHours();
    return actionOk({ entry: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update special hours.");
  }
}

export async function deleteSpecialHoursAction(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const parsed = deleteSpecialHoursSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid request.",
      );
    }

    const result = await deleteSpecialHours(
      parsed.data.restaurantId,
      parsed.data.specialHoursId,
    );
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateHours();
    return actionOk(result.data);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to delete special hours.");
  }
}
