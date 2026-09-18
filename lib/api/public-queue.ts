import { jsonFail, jsonOk, statusForActionCode } from "@/lib/api/json";
import {
  clientIpFromHeaders,
  consumePublicQueueRateLimit,
  type PublicQueueRateLimitAction,
} from "@/lib/security/rate-limit";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import type { ActionErrorCode } from "@/lib/errors/action";
import type { NextResponse } from "next/server";
import type { ActionResult } from "@/lib/errors/action";

export function publicQueueRateLimitResponse(
  request: Request,
  action: PublicQueueRateLimitAction,
): NextResponse<ActionResult<never>> | null {
  const result = consumePublicQueueRateLimit(
    action,
    clientIpFromHeaders(request.headers),
  );
  if (result.allowed) {
    return null;
  }
  const response = jsonFail(
    "RATE_LIMITED",
    PUBLIC_QUEUE_MESSAGES.rateLimited,
    429,
  );
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

export function publicQueueJsonFromResult<T>(
  result:
    | {
        ok: true;
        data: T;
      }
    | {
        ok: false;
        code: ActionErrorCode;
        message: string;
      },
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
