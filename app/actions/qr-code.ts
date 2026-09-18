"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import { DASHBOARD_QR_CODES_PATH } from "@/lib/auth/paths";
import {
  createQRCodeSchema,
  qrCodeIdSchema,
  setQRCodeStatusSchema,
  updateQRCodeSchema,
} from "@/lib/validations/qr-code";
import {
  createQRCode,
  regenerateQRCodeToken,
  setQRCodeStatus,
  updateQRCode,
  type QRCodeMutationResult,
  type QRCodeRecord,
} from "@/services/qr-codes";

function mapQRResult(
  result: QRCodeMutationResult,
): ActionResult<{ qrCode: QRCodeRecord }> {
  if (!result.ok) {
    return actionFail(result.code, result.message);
  }
  return actionOk({ qrCode: result.qrCode });
}

export async function createQRCodeAction(
  input: unknown,
): Promise<ActionResult<{ qrCode: QRCodeRecord }>> {
  try {
    const parsed = createQRCodeSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid QR code details.",
      );
    }

    const result = await createQRCode(parsed.data);
    if (result.ok) {
      revalidatePath(DASHBOARD_QR_CODES_PATH);
    }
    return mapQRResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create QR code.");
  }
}

export async function updateQRCodeAction(
  input: unknown,
): Promise<ActionResult<{ qrCode: QRCodeRecord }>> {
  try {
    const parsed = updateQRCodeSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid QR code details.",
      );
    }

    const result = await updateQRCode(parsed.data);
    if (result.ok) {
      revalidatePath(DASHBOARD_QR_CODES_PATH);
    }
    return mapQRResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update QR code.");
  }
}

export async function setQRCodeStatusAction(
  input: unknown,
): Promise<ActionResult<{ qrCode: QRCodeRecord }>> {
  try {
    const parsed = setQRCodeStatusSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid QR code status.",
      );
    }

    const result = await setQRCodeStatus(parsed.data);
    if (result.ok) {
      revalidatePath(DASHBOARD_QR_CODES_PATH);
    }
    return mapQRResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update QR code status.");
  }
}

export async function regenerateQRCodeTokenAction(
  input: unknown,
): Promise<ActionResult<{ qrCode: QRCodeRecord }>> {
  try {
    const parsed = qrCodeIdSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid QR code.",
      );
    }

    const result = await regenerateQRCodeToken(parsed.data.qrCodeId);
    if (result.ok) {
      revalidatePath(DASHBOARD_QR_CODES_PATH);
    }
    return mapQRResult(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to regenerate QR token.");
  }
}
