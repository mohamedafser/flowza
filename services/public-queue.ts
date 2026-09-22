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
import {
  joinPublicQueueSchema,
  publicBranchSlugParamsSchema,
} from "@/lib/validations/public-queue";
import type {
  PublicQueueInfo,
  PublicQueueJoinResponse,
  PublicQueueStatusResponse,
} from "@/lib/public-queue/types";
import { z } from "zod";

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

  if (!mapped.data.reused) {
    const { notifyQueueJoined } = await import("@/lib/notifications/queue");
    await notifyQueueJoined(mapped.data.entry.id);
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

  const { notifyQueueCancelled } = await import("@/lib/notifications/queue");
  await notifyQueueCancelled(parsed.data.entry.id);

  return { ok: true, data: toPublicQueueStatus(parsed.data) };
}

function sanitizePublicCustomerSearch(value: string): string {
  return value
    .trim()
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

const publicCustomerSearchResultSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().nullable(),
});

const publicCustomerSearchListSchema = z.array(publicCustomerSearchResultSchema);

function isMissingRpcError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    /could not find the function/i.test(error.message ?? "") ||
    /search_public_queue_customers/i.test(error.message ?? "")
  );
}

function escapePostgrestFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function searchCustomersAsMember(
  restaurantSlug: string,
  query: string,
): Promise<PublicQueueResult<{
  customers: Array<{ name: string; phone: string | null }>;
}> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", restaurantSlug)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return null;
  }

  const pattern = `%${escapePostgrestFilterValue(query)}%`;
  const { data, error } = await supabase
    .from("customers")
    .select("name, phone")
    .eq("restaurant_id", restaurant.id)
    .or(`name.ilike."${pattern}",phone.ilike."${pattern}"`)
    .order("name", { ascending: true })
    .limit(5);

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: PUBLIC_QUEUE_MESSAGES.unexpected,
    };
  }

  return {
    ok: true,
    data: {
      customers: (data ?? []).map((row) => ({
        name: row.name,
        phone: row.phone,
      })),
    },
  };
}

export async function searchPublicQueueCustomers(input: {
  restaurantSlug: string;
  branchSlug: string;
  query: string;
}): Promise<
  PublicQueueResult<{
    customers: Array<{ name: string; phone: string | null }>;
  }>
> {
  const params = publicBranchSlugParamsSchema.safeParse({
    restaurantSlug: input.restaurantSlug,
    branchSlug: input.branchSlug,
  });
  if (!params.success) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: PUBLIC_QUEUE_MESSAGES.notFound,
    };
  }

  const query = sanitizePublicCustomerSearch(input.query);
  if (query.length < 2) {
    return { ok: true, data: { customers: [] } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_public_queue_customers", {
    p_restaurant_slug: params.data.restaurantSlug,
    p_branch_slug: params.data.branchSlug,
    p_query: query,
  });

  if (!error) {
    if (data == null) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QUEUE_MESSAGES.notFound,
      };
    }

    const parsed = publicCustomerSearchListSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: PUBLIC_QUEUE_MESSAGES.unexpected,
      };
    }

    return { ok: true, data: { customers: parsed.data } };
  }

  // RPC not applied yet: fall back to member RLS search when a staff session
  // is present (local QR testing). True anonymous guests need the migration.
  if (isMissingRpcError(error)) {
    const memberResult = await searchCustomersAsMember(
      params.data.restaurantSlug,
      query,
    );
    if (memberResult) {
      return memberResult;
    }
  }

  return mapPublicQueueError(error, PUBLIC_QUEUE_MESSAGES.unexpected);
}
