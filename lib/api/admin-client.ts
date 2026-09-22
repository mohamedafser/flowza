"use client";

import type { ActionResult } from "@/lib/errors/action";

export async function adminFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<ActionResult<T>> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  try {
    return (await response.json()) as ActionResult<T>;
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to parse admin response.",
    };
  }
}
