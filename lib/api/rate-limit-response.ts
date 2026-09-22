import { NextResponse } from "next/server";
import { jsonFail } from "@/lib/api/json";
import { logSecurityEvent } from "@/lib/security/logging";
import {
  clientIpFromHeaders,
  consumeAppRateLimit,
  resolveAppRateLimitAction,
  type AppRateLimitAction,
} from "@/lib/security/rate-limit";

const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

export function appRateLimitResponse(
  request: Request,
  action: AppRateLimitAction,
  extraKey = "",
): NextResponse | null {
  const ip = clientIpFromHeaders(request.headers);
  const result = consumeAppRateLimit(action, ip, extraKey);
  if (result.allowed) {
    return null;
  }

  logSecurityEvent("RATE_LIMIT_VIOLATION", {
    action,
    path: new URL(request.url).pathname,
    method: request.method,
    ip,
  });

  const response = jsonFail("RATE_LIMITED", RATE_LIMIT_MESSAGE, 429);
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}

/**
 * Resolve and enforce app rate limits for sensitive API paths.
 * Returns a 429 response when limited; otherwise null.
 */
export function enforceSensitiveApiRateLimit(
  request: Request,
): NextResponse | null {
  const url = new URL(request.url);
  const action = resolveAppRateLimitAction(url.pathname, request.method);
  if (!action) {
    return null;
  }
  return appRateLimitResponse(request, action);
}
