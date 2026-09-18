import type { ActionResult } from "@/lib/errors/action";
import { publicDisplayApiPath } from "@/lib/public-display/paths";
import type { PublicDisplayResponse } from "@/lib/public-display/types";

export async function fetchPublicDisplay(
  publicToken: string,
): Promise<ActionResult<PublicDisplayResponse>> {
  try {
    const response = await fetch(publicDisplayApiPath(publicToken), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = (await response.json()) as ActionResult<PublicDisplayResponse>;
    return body;
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Network error. Check your connection and try again.",
    };
  }
}
