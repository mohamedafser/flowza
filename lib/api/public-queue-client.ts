import { parseJsonResult } from "@/lib/api/client";
import { JSON_HEADERS } from "@/lib/api/client";
import {
  publicQueueCancelApiPath,
  publicQueueInfoApiPath,
  publicQueueJoinApiPath,
  publicQueueSearchApiPath,
  publicQueueStatusApiPath,
} from "@/lib/public-queue/paths";
import type { ActionResult } from "@/lib/errors/action";
import type {
  PublicQueueInfo,
  PublicQueueJoinResponse,
  PublicQueueStatusResponse,
} from "@/lib/public-queue/types";
import type { PublicQueueCustomerSearchResult } from "@/lib/validations/public-queue";

export async function fetchPublicQueueInfo(
  restaurantSlug: string,
  branchSlug: string,
): Promise<ActionResult<PublicQueueInfo>> {
  try {
    const response = await fetch(
      publicQueueInfoApiPath(restaurantSlug, branchSlug),
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    return parseJsonResult<PublicQueueInfo>(response);
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Network error. Check your connection and try again.",
    };
  }
}

export async function searchPublicQueueCustomersRequest(input: {
  restaurantSlug: string;
  branchSlug: string;
  query: string;
}): Promise<ActionResult<{ customers: PublicQueueCustomerSearchResult[] }>> {
  try {
    const path = publicQueueSearchApiPath(
      input.restaurantSlug,
      input.branchSlug,
    );
    const params = new URLSearchParams({ query: input.query });
    const response = await fetch(`${path}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    });
    return parseJsonResult<{ customers: PublicQueueCustomerSearchResult[] }>(
      response,
    );
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Network error. Check your connection and try again.",
    };
  }
}

export async function joinPublicQueueRequest(input: {
  restaurantSlug: string;
  branchSlug: string;
  name: string;
  phone: string;
  partySize: number;
}): Promise<ActionResult<PublicQueueJoinResponse>> {
  try {
    const response = await fetch(
      publicQueueJoinApiPath(input.restaurantSlug, input.branchSlug),
      {
        method: "POST",
        headers: JSON_HEADERS,
        cache: "no-store",
        body: JSON.stringify({
          name: input.name,
          phone: input.phone,
          partySize: input.partySize,
        }),
      },
    );
    return parseJsonResult<PublicQueueJoinResponse>(response);
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Network error. Check your connection and try again.",
    };
  }
}

export async function fetchPublicQueueStatus(
  accessToken: string,
): Promise<ActionResult<PublicQueueStatusResponse>> {
  try {
    const response = await fetch(publicQueueStatusApiPath(accessToken), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return parseJsonResult<PublicQueueStatusResponse>(response);
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Network error. Check your connection and try again.",
    };
  }
}

export async function cancelPublicQueueRequest(
  accessToken: string,
): Promise<ActionResult<PublicQueueStatusResponse>> {
  try {
    const response = await fetch(publicQueueCancelApiPath(accessToken), {
      method: "POST",
      headers: JSON_HEADERS,
      cache: "no-store",
    });
    return parseJsonResult<PublicQueueStatusResponse>(response);
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Network error. Check your connection and try again.",
    };
  }
}
