import { NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/auth/guards";
import type { ActionErrorCode, ActionResult } from "@/lib/errors/action";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function jsonOk<T>(
  data: T,
  status = 200,
): NextResponse<ActionResult<T>> {
  return NextResponse.json({ ok: true, data }, { status, headers: NO_STORE });
}

export function jsonFail<T = never>(
  code: ActionErrorCode,
  message: string,
  status: number,
  data?: T,
): NextResponse<ActionResult<T>> {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
    { status, headers: NO_STORE },
  );
}

export function jsonFromAuthorizationError(
  error: AuthorizationError,
): NextResponse<ActionResult<never>> {
  const status =
    error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "UNVERIFIED"
        ? 403
        : error.code === "NO_MEMBERSHIP"
          ? 404
          : 403;
  return jsonFail(error.code, error.message, status);
}

export function statusForActionCode(code: ActionErrorCode): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    case "UNVERIFIED":
    case "FORBIDDEN":
      return 403;
    case "NO_MEMBERSHIP":
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "SUBSCRIPTION_LIMIT_REACHED":
    case "SUBSCRIPTION_FEATURE_BLOCKED":
    case "SUBSCRIPTION_DOWNGRADE_BLOCKED":
      return 409;
    case "RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}

export async function readJsonBody(
  request: Request,
): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  try {
    const body: unknown = await request.json();
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: jsonFail("VALIDATION", "Request body must be valid JSON.", 400),
    };
  }
}
