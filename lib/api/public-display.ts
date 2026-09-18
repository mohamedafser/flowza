import { jsonFail, jsonOk, statusForActionCode } from "@/lib/api/json";
import {
  clientIpFromHeaders,
  consumePublicQueueRateLimit,
} from "@/lib/security/rate-limit";
import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import type { ActionErrorCode, ActionResult } from "@/lib/errors/action";
import type { NextResponse } from "next/server";

export function publicDisplayRateLimitResponse(
  request: Request,
): NextResponse<ActionResult<never>> | null {
  const result = consumePublicQueueRateLimit(
    "display",
    clientIpFromHeaders(request.headers),
  );
  if (result.allowed) {
    return null;
  }
  const response = jsonFail(
    "RATE_LIMITED",
    PUBLIC_DISPLAY_MESSAGES.rateLimited,
    429,
  );
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

export function publicDisplayJsonFromResult<T>(
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
