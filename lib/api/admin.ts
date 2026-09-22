import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  statusForActionCode,
} from "@/lib/api/json";
import type { ActionErrorCode } from "@/lib/errors/action";
import { NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";

export function adminJsonOk<T>(data: T, status = 200) {
  return jsonOk(data, status);
}

export function handleAdminError(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return jsonFromAuthorizationError(error);
  }

  const message =
    error instanceof Error ? error.message : "Unable to complete request.";

  // Map known safe domain errors; never return raw stack/SQL/provider details.
  if (/not found/i.test(message)) {
    return jsonFail("NOT_FOUND", "Resource not found.", 404);
  }
  if (/cannot|invalid|required|already exists/i.test(message)) {
    return jsonFail(
      "VALIDATION",
      /already exists/i.test(message)
        ? "That value is already in use."
        : "Invalid request.",
      400,
    );
  }
  if (/service role/i.test(message)) {
    return jsonFail("UNKNOWN", "Platform admin is not configured.", 500);
  }

  return jsonFail("UNKNOWN", "Unable to complete request.", 500);
}

export function parseAdminQuery<T extends ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams,
):
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid query.",
        400,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function failFromCode(
  code: ActionErrorCode,
  message: string,
): NextResponse {
  return jsonFail(code, message, statusForActionCode(code));
}
