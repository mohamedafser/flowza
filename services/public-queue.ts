import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { safeDatabaseMessage } from "@/lib/errors/action";
import type { ActionErrorCode } from "@/lib/errors/action";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import {
  publicQueueRpcInfoSchema,
  publicQueueRpcJoinSchema,
  publicQueueRpcStatusSchema,
  toPublicQueueInfo,
  toPublicQueueJoin,
  toPublicQueueStatus,
} from "@/lib/public-queue/dto";
import { isValidPublicAccessToken } from "@/lib/public-queue/paths";
import { joinPublicQueueSchema } from "@/lib/validations/public-queue";
import type {
  PublicQueueInfo,
  PublicQueueJoinResponse,
  PublicQueueStatusResponse,
} from "@/lib/public-queue/types";

export type PublicQueueResult<T> =
  { ok: true; data: T } | { ok: false; code: ActionErrorCode; message: string };

function mapPublicQueueError(
  error: { message?: string } | null,
  fallback: string,
): PublicQueueResult<never> {
  const raw = error?.message ?? "";
  const match = /^([A-Z_]+):\s*(.*)$/.exec(raw);
  const key = match?.[1] ?? "";
  const text = match?.[2] ?? "";

  switch (key) {
    case "QUEUE_PAUSED":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.paused,
      };
    case "QUEUE_CLOSED":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.closed,
      };
    case "QUEUE_AT_CAPACITY":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.full,
      };
    case "QUEUE_OUTSIDE_HOURS":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.outsideHours,
      };
    case "QUEUE_DISABLED":
    case "QUEUE_SELF_CHECK_IN_DISABLED":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.disabled,
      };
    case "QUEUE_VALIDATION":
      return {
        ok: false,
        code: "VALIDATION",
        message: text || PUBLIC_QUEUE_MESSAGES.unableToJoin,
      };
    case "QUEUE_NOT_FOUND":
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QUEUE_MESSAGES.notFound,
      };
    case "QUEUE_INVALID_TOKEN":
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QUEUE_MESSAGES.invalidToken,
      };
    case "QUEUE_CANCEL_DISABLED":
      return {
        ok: false,
        code: "FORBIDDEN",
        message: PUBLIC_QUEUE_MESSAGES.cancelDisabled,
      };
    case "QUEUE_ALREADY_CANCELLED":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.alreadyCancelled,
      };
    case "QUEUE_INVALID_TRANSITION":
      return {
        ok: false,
        code: "VALIDATION",
        message: PUBLIC_QUEUE_MESSAGES.invalidCancel,
      };
    default:
      return {
        ok: false,
        code: "UNKNOWN",
        message: safeDatabaseMessage(error, fallback),
      };
  }
}

export const getPublicQueueInfo = cache(
  async (
    restaurantSlug: string,
    branchSlug: string,
  ): Promise<PublicQueueResult<PublicQueueInfo>> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_queue_info", {
      p_restaurant_slug: restaurantSlug,
      p_branch_slug: branchSlug,
    });

    if (error) {
      return mapPublicQueueError(error, PUBLIC_QUEUE_MESSAGES.unexpected);
    }

    if (data == null) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QUEUE_MESSAGES.notFound,
      };
    }

    const parsed = publicQueueRpcInfoSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: PUBLIC_QUEUE_MESSAGES.unexpected,
      };
    }

    return { ok: true, data: toPublicQueueInfo(parsed.data) };
  },
);

export async function joinPublicQueue(input: {
  restaurantSlug: string;
  branchSlug: string;
  name: unknown;
  phone: unknown;
  partySize: unknown;
}): Promise<PublicQueueResult<PublicQueueJoinResponse>> {
  const parsed = joinPublicQueueSchema({
    requirePhone: false,
  }).safeParse({
    name: input.name,
    phone: input.phone,
    partySize: input.partySize,
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Enter valid details.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("queue_join_public", {
    p_restaurant_slug: input.restaurantSlug,
    p_branch_slug: input.branchSlug,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_party_size: parsed.data.partySize,
  });

  if (error || data == null) {
    return mapPublicQueueError(error, PUBLIC_QUEUE_MESSAGES.unableToJoin);
  }

  const mapped = publicQueueRpcJoinSchema.safeParse(data);
  if (!mapped.success) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: PUBLIC_QUEUE_MESSAGES.unableToJoin,
    };
  }

  return { ok: true, data: toPublicQueueJoin(mapped.data) };
}

export const getPublicQueueStatus = cache(
  async (
    accessToken: string,
  ): Promise<PublicQueueResult<PublicQueueStatusResponse>> => {
    if (!isValidPublicAccessToken(accessToken)) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QUEUE_MESSAGES.invalidToken,
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_queue_status", {
      p_access_token: accessToken,
    });

    if (error) {
      return mapPublicQueueError(error, PUBLIC_QUEUE_MESSAGES.unexpected);
    }

    if (data == null) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QUEUE_MESSAGES.invalidToken,
      };
    }

    const parsed = publicQueueRpcStatusSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: PUBLIC_QUEUE_MESSAGES.unexpected,
      };
    }

    return { ok: true, data: toPublicQueueStatus(parsed.data) };
  },
);

export async function cancelPublicQueueEntry(
  accessToken: string,
): Promise<PublicQueueResult<PublicQueueStatusResponse>> {
  if (!isValidPublicAccessToken(accessToken)) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: PUBLIC_QUEUE_MESSAGES.invalidToken,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_public_queue_entry", {
    p_access_token: accessToken,
  });

  if (error || data == null) {
    return mapPublicQueueError(error, PUBLIC_QUEUE_MESSAGES.invalidCancel);
  }

  const parsed = publicQueueRpcStatusSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: PUBLIC_QUEUE_MESSAGES.unexpected,
    };
  }

  return { ok: true, data: toPublicQueueStatus(parsed.data) };
}
