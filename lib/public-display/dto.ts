import { z } from "zod";
import { isSafeRealtimeChannel } from "@/lib/realtime/channels";
import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import {
  displayQueueStatusLabel,
  type PublicDisplayData,
  type PublicDisplayResponse,
  type PublicDisplayUnavailable,
} from "@/lib/public-display/types";
import {
  normalizeDisplaySettings,
  type DisplaySettings,
} from "@/lib/validations/display";

const queueStatusSchema = z.enum(["ACTIVE", "PAUSED", "CLOSED"]);

const tokenRefSchema = z.object({
  token: z.string().min(1).max(32),
});

export const publicDisplayRpcSchema = z.object({
  unavailable: z.boolean(),
  reason: z.enum(["inactive", "queue_unavailable"]).optional(),
  display: z
    .object({
      name: z.string(),
      mode: z.enum(["QUEUE", "TABLES", "COMBINED"]),
    })
    .optional(),
  restaurant: z
    .object({
      name: z.string(),
      logo_url: z.string().nullable().optional(),
    })
    .optional(),
  branch: z
    .object({
      name: z.string(),
    })
    .optional(),
  queue: z
    .object({
      name: z.string(),
      status: queueStatusSchema,
      status_label: z.string().optional(),
    })
    .optional(),
  now_serving: tokenRefSchema.nullable().optional(),
  next_tokens: z.array(tokenRefSchema).optional(),
  settings: z.record(z.unknown()).optional(),
  realtime_channel: z.string().nullable().optional(),
});

export type PublicDisplayRpc = z.infer<typeof publicDisplayRpcSchema>;

function mapUnavailable(
  reason: PublicDisplayUnavailable["reason"],
): PublicDisplayUnavailable {
  const message =
    reason === "inactive"
      ? PUBLIC_DISPLAY_MESSAGES.inactive
      : reason === "queue_unavailable"
        ? PUBLIC_DISPLAY_MESSAGES.queueUnavailable
        : PUBLIC_DISPLAY_MESSAGES.notFound;

  return {
    unavailable: true,
    reason,
    message,
  };
}

function mapRealtimeChannel(value: string | null | undefined): string | null {
  if (!value) return null;
  return isSafeRealtimeChannel(value) ? value : null;
}

export function toPublicDisplayData(
  raw: PublicDisplayRpc,
): PublicDisplayResponse {
  if (raw.unavailable) {
    return mapUnavailable(raw.reason ?? "not_found");
  }

  if (!raw.display || !raw.restaurant || !raw.branch || !raw.queue) {
    return mapUnavailable("not_found");
  }

  // Phase 11 only supports QUEUE displays publicly.
  if (raw.display.mode !== "QUEUE") {
    return mapUnavailable("inactive");
  }

  const settings: DisplaySettings = normalizeDisplaySettings(raw.settings);
  const status = raw.queue.status;

  let nowServing = raw.now_serving ?? null;
  if (status === "CLOSED" && !nowServing) {
    nowServing = null;
  }

  const data: PublicDisplayData = {
    unavailable: false,
    display: {
      name: raw.display.name,
      mode: "QUEUE",
    },
    restaurant: {
      name: raw.restaurant.name,
      logoUrl: raw.restaurant.logo_url ?? null,
    },
    branch: {
      name: raw.branch.name,
    },
    queue: {
      name: raw.queue.name,
      status,
      statusLabel: raw.queue.status_label ?? displayQueueStatusLabel(status),
    },
    nowServing: nowServing ? { token: nowServing.token } : null,
    nextTokens: (raw.next_tokens ?? [])
      .slice(0, settings.nextTokenCount)
      .map((entry) => ({ token: entry.token })),
    settings,
    realtimeChannel: mapRealtimeChannel(raw.realtime_channel),
  };

  return data;
}

export function collectObjectKeys(
  value: unknown,
  into = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      collectObjectKeys(nested, into);
    }
  }
  return into;
}
