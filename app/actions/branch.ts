"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import {
  createBranchSchema,
  setBranchStatusSchema,
  toBranchPayload,
  updateBranchSchema,
} from "@/lib/validations/branch";
import {
  createBranch,
  setBranchStatus,
  updateBranch,
  type BranchMutationResult,
} from "@/services/branches";
import type { Branch } from "@/lib/context/restaurant";

function mapBranchResult(
  result: BranchMutationResult,
): ActionResult<{ branch: Branch }> {
  if (!result.ok) {
    return actionFail(result.code, result.message);
  }
  return actionOk({ branch: result.branch });
}

export async function createBranchAction(
  input: unknown,
): Promise<ActionResult<{ branch: Branch }>> {
  try {
    const parsed = createBranchSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid branch details.",
      );
    }

    const { restaurantId, ...fields } = parsed.data;
    const result = await createBranch({
      restaurantId,
      ...toBranchPayload(fields),
    });
    if (result.ok) {
      revalidatePath(SETTINGS_BRANCHES_PATH);
      revalidatePath("/", "layout");
    }
    return mapBranchResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create branch.");
  }
}

export async function updateBranchAction(
  input: unknown,
): Promise<ActionResult<{ branch: Branch }>> {
  try {
    const parsed = updateBranchSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid branch details.",
      );
    }

    const { branchId, ...fields } = parsed.data;
    const result = await updateBranch({
      branchId,
      ...toBranchPayload(fields),
    });
    if (result.ok) {
      revalidatePath(SETTINGS_BRANCHES_PATH);
      revalidatePath(`${SETTINGS_BRANCHES_PATH}/${branchId}`);
      revalidatePath("/", "layout");
    }
    return mapBranchResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update branch.");
  }
}

export async function setBranchStatusAction(
  input: unknown,
): Promise<ActionResult<{ branch: Branch }>> {
  try {
    const parsed = setBranchStatusSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid branch status.",
      );
    }

    const result = await setBranchStatus(parsed.data);
    if (result.ok) {
      revalidatePath(SETTINGS_BRANCHES_PATH);
      revalidatePath(`${SETTINGS_BRANCHES_PATH}/${parsed.data.branchId}`);
      revalidatePath("/", "layout");
    }
    return mapBranchResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update branch status.");
  }
}
