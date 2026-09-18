import { jsonFail, jsonOk, statusForActionCode } from "@/lib/api/json";
import {
  clientIpFromHeaders,
  consumePublicQueueRateLimit,
} from "@/lib/security/rate-limit";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import type { ActionErrorCode, ActionResult } from "@/lib/errors/action";
import type { NextResponse } from "next/server";

export function publicQRRateLimitResponse(
  request: Request,
): NextResponse<ActionResult<never>> | null {
  const result = consumePublicQueueRateLimit(
    "qr",
    clientIpFromHeaders(request.headers),
  );
  if (result.allowed) {
    return null;
  }
  const response = jsonFail(
    "RATE_LIMITED",
    PUBLIC_QR_MESSAGES.rateLimited,
    429,
  );
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

export function publicQRJsonFromResult<T>(
  result:
    | { ok: true; data: T }
    | { ok: false; code: ActionErrorCode; message: string },
): NextResponse<ActionResult<T> | ActionResult<never>> {
  if (result.ok) {
    return jsonOk(result.data);
  }
  return jsonFail(
    result.code,
    result.message,
    statusForActionCode(result.code),
  );
}
