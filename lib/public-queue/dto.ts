import { z } from "zod";
import { slugify } from "@/lib/utils/slug";
import { estimateWaitTime } from "@/lib/queue/estimateWaitTime";
import { queueTableLabel } from "@/lib/utils/queue";
import { canTransitionQueueStatus } from "@/lib/queue/transitions";
import { MAX_PARTY_SIZE } from "@/lib/validations/queue";
import { availabilityMessage } from "@/lib/public-queue/messages";
import { publicQueueStatusPath } from "@/lib/public-queue/paths";
import { isSafeRealtimeChannel } from "@/lib/realtime/channels";
import type {
  PublicQueueAvailabilityReason,
  PublicQueueCustomerSettings,
  PublicQueueEntryStatus,
  PublicQueueInfo,
  PublicQueueJoinResponse,
  PublicQueueStatusResponse,
} from "@/lib/public-queue/types";
import { PUBLIC_QUEUE_AVAILABILITY_REASONS } from "@/lib/public-queue/types";
import type { QueueEntryStatus, QueueStatus } from "@/lib/validations/queue";

const queueStatusSchema = z.enum(["ACTIVE", "PAUSED", "CLOSED"]);
const entryStatusSchema = z.enum([
  "WAITING",
  "CALLED",
  "SEATED",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
  "NO_SHOW",
]);

const brandSchema = z.object({
  name: z.string(),
  slug: z.string(),
  logo_url: z.string().nullable().optional(),
});

const branchSchema = z.object({
  name: z.string(),
  slug: z.string(),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

const settingsSchema = z.object({
  queue_enabled: z.boolean().optional(),
  allow_self_check_in: z.boolean().optional(),
  allow_walk_ins: z.boolean().optional(),
  require_customer_name: z.boolean().optional(),
  require_customer_phone: z.boolean().optional(),
  show_estimated_wait: z.boolean().optional(),
  show_queue_position: z.boolean().optional(),
  show_party_size: z.boolean().optional(),
  allow_customer_cancel: z.boolean().optional(),
  max_queue_capacity: z.number().nullable().optional(),
  default_service_minutes: z.number().optional(),
});

const peerSchema = z.object({
  id: z.string(),
  status: entryStatusSchema,
  joined_at: z.string(),
  party_size: z.number(),
  token: z.string(),
});

const entrySchema = z.object({
  id: z.string(),
  token: z.string(),
  status: entryStatusSchema,
  party_size: z.number(),
  joined_at: z.string(),
  table_number: z.string().nullable().optional(),
  table_name: z.string().nullable().optional(),
});

export const publicQueueRpcInfoSchema = z.object({
  restaurant: brandSchema,
  branch: branchSchema,
  queue: z
    .object({
      name: z.string(),
      status: queueStatusSchema,
    })
    .nullable(),
  settings: settingsSchema.nullable().optional(),
  timezone: z.string(),
  is_open: z.boolean(),
  waiting_count: z.number(),
  serving_count: z.number(),
  now_serving_token: z.string().nullable().optional(),
  estimated_service_minutes: z.number(),
  availability_reason: z.enum(PUBLIC_QUEUE_AVAILABILITY_REASONS),
  peers: z.array(peerSchema).optional(),
});

export const publicQueueRpcStatusSchema = z.object({
  restaurant: brandSchema,
  branch: branchSchema,
  queue: z.object({
    name: z.string(),
    status: queueStatusSchema,
  }),
  settings: settingsSchema.nullable().optional(),
  timezone: z.string(),
  estimated_service_minutes: z.number(),
  allow_customer_cancel: z.boolean().optional(),
  entry: entrySchema,
  peers: z.array(peerSchema),
  realtime_channel: z.string().min(1).nullable().optional(),
});

export const publicQueueRpcJoinSchema = publicQueueRpcStatusSchema.extend({
  access_token: z.string().min(32).max(64),
  reused: z.boolean(),
});

export type PublicQueueRpcInfo = z.infer<typeof publicQueueRpcInfoSchema>;
export type PublicQueueRpcStatus = z.infer<typeof publicQueueRpcStatusSchema>;
export type PublicQueueRpcJoin = z.infer<typeof publicQueueRpcJoinSchema>;

export function formatPublicAddress(input: {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string | null {
  const parts = [
    input.address_line_1,
    input.address_line_2,
    input.city,
    input.state,
    input.postal_code,
    input.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

function mapSettings(
  settings: z.infer<typeof settingsSchema> | null | undefined,
): PublicQueueCustomerSettings {
  return {
    requireCustomerName: settings?.require_customer_name ?? true,
    requireCustomerPhone: settings?.require_customer_phone ?? true,
    showEstimatedWait: settings?.show_estimated_wait ?? true,
    showQueuePosition: settings?.show_queue_position ?? true,
    showPartySize: settings?.show_party_size ?? true,
    allowCustomerCancel: settings?.allow_customer_cancel ?? true,
    allowSelfCheckIn: settings?.allow_self_check_in ?? true,
    maxPartySize: MAX_PARTY_SIZE,
  };
}

function mapBrand(input: z.infer<typeof brandSchema>) {
  return {
    name: input.name,
    slug: input.slug,
    logoUrl: input.logo_url ?? null,
  };
}

function mapBranch(input: z.infer<typeof branchSchema>) {
  return {
    name: input.name,
    slug: input.slug,
    address: formatPublicAddress(input),
  };
}

function mapQueue(input: { name: string; status: QueueStatus }) {
  return {
    name: input.name,
    slug: slugify(input.name),
    status: input.status,
  };
}

export function mapAvailability(
  reason: PublicQueueAvailabilityReason,
  isOpen: boolean,
): PublicQueueInfo["availability"] {
  return {
    canJoin: reason === "ok",
    reason,
    message: availabilityMessage(reason),
    isOpen,
  };
}

function nowServingToken(
  peers: Array<{ status: QueueEntryStatus; token: string; joined_at: string }>,
  fallback?: string | null,
): string | null {
  if (fallback) return fallback;
  const serving = peers
    .filter((peer) => peer.status === "CALLED" || peer.status === "SEATED")
    .slice()
    .sort((left, right) => right.joined_at.localeCompare(left.joined_at));
  return serving[0]?.token ?? null;
}

function mapEntryStatus(input: {
  entry: z.infer<typeof entrySchema>;
  peers: Array<z.infer<typeof peerSchema>>;
  estimatedServiceMinutes: number;
  settings: PublicQueueCustomerSettings;
  allowCustomerCancel?: boolean;
}): PublicQueueEntryStatus {
  const estimate = estimateWaitTime({
    entries: input.peers,
    entryId: input.entry.id,
    estimatedServiceMinutes: input.estimatedServiceMinutes,
  });
  const showWait = input.settings.showEstimatedWait;
  const showPosition = input.settings.showQueuePosition;
  const serving = nowServingToken(input.peers);
  const canCancel =
    (input.allowCustomerCancel ?? input.settings.allowCustomerCancel) &&
    canTransitionQueueStatus(input.entry.status, "CANCELLED") &&
    input.entry.status !== "CANCELLED";

  return {
    token: input.entry.token,
    status: input.entry.status,
    partySize: input.entry.party_size,
    position: showPosition ? estimate.position : null,
    partiesAhead:
      showPosition && estimate.position != null ? estimate.partiesAhead : null,
    estimatedWaitMinutes: showWait ? estimate.estimatedWaitMinutes : null,
    nowServingToken: serving,
    tableLabel: queueTableLabel(
      input.entry.table_number
        ? {
            table_number: input.entry.table_number,
            name: input.entry.table_name ?? null,
          }
        : null,
    ),
    canCancel,
  };
}

export function toPublicQueueInfo(raw: PublicQueueRpcInfo): PublicQueueInfo {
  const settings = mapSettings(raw.settings);
  const estimatedWaitMinutes = settings.showEstimatedWait
    ? (raw.waiting_count + raw.serving_count) * raw.estimated_service_minutes
    : null;

  return {
    restaurant: mapBrand(raw.restaurant),
    branch: mapBranch(raw.branch),
    queue: raw.queue ? mapQueue(raw.queue) : null,
    availability: mapAvailability(raw.availability_reason, raw.is_open),
    waitingCount: raw.waiting_count,
    nowServingToken: raw.now_serving_token ?? nowServingToken(raw.peers ?? []),
    estimatedWaitMinutes,
    settings,
    timezone: raw.timezone || "UTC",
  };
}

function mapRealtimeChannel(value: string | null | undefined): string | null {
  if (!value) return null;
  return isSafeRealtimeChannel(value) ? value : null;
}

export function toPublicQueueStatus(
  raw: PublicQueueRpcStatus,
): PublicQueueStatusResponse {
  const settings = mapSettings(raw.settings);
  return {
    restaurant: mapBrand(raw.restaurant),
    branch: mapBranch(raw.branch),
    queue: mapQueue(raw.queue),
    entry: mapEntryStatus({
      entry: raw.entry,
      peers: raw.peers,
      estimatedServiceMinutes: raw.estimated_service_minutes,
      settings,
      allowCustomerCancel: raw.allow_customer_cancel,
    }),
    settings,
    timezone: raw.timezone || "UTC",
    realtimeChannel: mapRealtimeChannel(raw.realtime_channel),
  };
}

export function toPublicQueueJoin(
  raw: PublicQueueRpcJoin,
): PublicQueueJoinResponse {
  const status = toPublicQueueStatus(raw);
  return {
    accessToken: raw.access_token,
    statusPath: publicQueueStatusPath(
      status.restaurant.slug,
      status.branch.slug,
      raw.access_token,
    ),
    reused: raw.reused,
    status,
  };
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
