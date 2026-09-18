"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import { DASHBOARD_DISPLAYS_PATH } from "@/lib/auth/paths";
import {
  createDisplaySchema,
  displayIdSchema,
  setDisplayStatusSchema,
  updateDisplaySchema,
} from "@/lib/validations/display";
import {
  createDisplay,
  deleteDisplay,
  setDisplayStatus,
  updateDisplay,
  type DisplayMutationResult,
  type DisplayRecord,
} from "@/services/displays";

function mapDisplayResult(
  result: DisplayMutationResult,
): ActionResult<{ display: DisplayRecord }> {
  if (!result.ok) {
    return actionFail(result.code, result.message);
  }
  return actionOk({ display: result.display });
}

export async function createDisplayAction(
  input: unknown,
): Promise<ActionResult<{ display: DisplayRecord }>> {
  try {
    const parsed = createDisplaySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid display details.",
      );
    }

    const result = await createDisplay(parsed.data);
    if (result.ok) {
      revalidatePath(DASHBOARD_DISPLAYS_PATH);
    }
    return mapDisplayResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create display.");
  }
}

export async function updateDisplayAction(
  input: unknown,
): Promise<ActionResult<{ display: DisplayRecord }>> {
  try {
    const parsed = updateDisplaySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid display details.",
      );
    }

    const result = await updateDisplay(parsed.data);
    if (result.ok) {
      revalidatePath(DASHBOARD_DISPLAYS_PATH);
    }
    return mapDisplayResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update display.");
  }
}

export async function setDisplayStatusAction(
  input: unknown,
): Promise<ActionResult<{ display: DisplayRecord }>> {
  try {
    const parsed = setDisplayStatusSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid display status.",
      );
    }

    const result = await setDisplayStatus(parsed.data);
    if (result.ok) {
      revalidatePath(DASHBOARD_DISPLAYS_PATH);
    }
    return mapDisplayResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update display status.");
  }
}

export async function deleteDisplayAction(
  input: unknown,
): Promise<ActionResult<{ display: DisplayRecord }>> {
  try {
    const parsed = displayIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid display.",
      );
    }

    const result = await deleteDisplay(parsed.data.displayId);
    if (result.ok) {
      revalidatePath(DASHBOARD_DISPLAYS_PATH);
    }
    return mapDisplayResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to delete display.");
  }
}
