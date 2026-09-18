import type { ActionResult } from "@/lib/errors/action";

export const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

export const JSON_ACCEPT = {
  Accept: "application/json",
} as const;

/**
 * Parse a Route Handler response as ActionResult JSON.
 * Rejects Next.js RSC / Server Action flight payloads.
 */
export async function parseJsonResult<T>(
  response: Response,
): Promise<ActionResult<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unexpected server response. Please try again.",
    };
  }

  try {
    return (await response.json()) as ActionResult<T>;
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unexpected server response. Please try again.",
    };
  }
}

export function toSearchParams(
  record: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}
