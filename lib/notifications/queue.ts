import { buildIdempotencyKey } from "@/lib/notifications/constants";
import { logNotificationEvent } from "@/lib/notifications/log";
import { isWebPushConfigured } from "@/lib/notifications/push/config";
import {
  scheduleNotificationWork,
  sendNotification,
} from "@/lib/notifications/service";
import type {
  NotificationChannel,
  QueueNotificationTemplateData,
} from "@/lib/notifications/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntryRecord } from "@/lib/utils/queue";

export type QueueNotificationContext = {
  restaurantId: string;
  restaurantName: string;
  branchId: string;
  branchName: string;
  queueId: string;
  queueName: string;
  entry: QueueEntryRecord;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  estimatedWaitMinutes: number | null;
  position: number | null;
  waitingCount: number;
};

async function loadQueueNotificationContext(
  entryId: string,
): Promise<QueueNotificationContext | null> {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const admin = createServiceRoleClient();

  // Prefer the signed-in member client (has table grants). Service role is
  // used for anonymous public-queue joins when grants are available.
  const clients = user
    ? admin
      ? [userClient, admin]
      : [userClient]
    : admin
      ? [admin, userClient]
      : [userClient];

  let entry: {
    id: string;
    queue_id: string;
    customer_id: string | null;
    table_id: string | null;
    token: string;
    business_date: string;
    party_size: number;
    status: QueueEntryRecord["status"];
    joined_at: string;
    called_at: string | null;
    seated_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    skipped_at: string | null;
    no_show_at: string | null;
    created_at: string;
    updated_at: string;
  } | null = null;
  let client = clients[0]!;

  for (const candidate of clients) {
    const { data, error } = await candidate
      .from("queue_entries")
      .select(
        "id, queue_id, customer_id, table_id, token, business_date, party_size, status, joined_at, called_at, seated_at, completed_at, cancelled_at, skipped_at, no_show_at, created_at, updated_at",
      )
      .eq("id", entryId)
      .maybeSingle();

    if (error) {
      logNotificationEvent("context_load_error", {
        queueEntryId: entryId,
        result: "failed",
        errorCode: "UNKNOWN",
      });
      console.error(
        JSON.stringify({
          scope: "notifications",
          message: "context_load_error",
          queueEntryId: entryId,
          error: error.message,
          code: error.code,
        }),
      );
      continue;
    }

    if (data) {
      entry = data;
      client = candidate;
      break;
    }
  }

  if (!entry) {
    return null;
  }

  const { data: queue, error: queueError } = await client
    .from("queues")
    .select("id, name, branch_id")
    .eq("id", entry.queue_id)
    .maybeSingle();

  if (queueError || !queue) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "context_queue_missing",
        queueEntryId: entryId,
        error: queueError?.message ?? "not_found",
      }),
    );
    return null;
  }

  const { data: branch, error: branchError } = await client
    .from("branches")
    .select("id, name, restaurant_id")
    .eq("id", queue.branch_id)
    .maybeSingle();

  if (branchError || !branch) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "context_branch_missing",
        queueEntryId: entryId,
        error: branchError?.message ?? "not_found",
      }),
    );
    return null;
  }

  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("id, name")
    .eq("id", branch.restaurant_id)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "context_restaurant_missing",
        queueEntryId: entryId,
        error: restaurantError?.message ?? "not_found",
      }),
    );
    return null;
  }

  let customer: QueueNotificationContext["customer"] = null;
  if (entry.customer_id) {
    const { data: customerRow } = await client
      .from("customers")
      .select("id, name, phone, email")
      .eq("id", entry.customer_id)
      .maybeSingle();

    if (customerRow) {
      customer = customerRow;
    }
  }

  const { count } = await client
    .from("queue_entries")
    .select("id", { count: "exact", head: true })
    .eq("queue_id", entry.queue_id)
    .eq("business_date", entry.business_date)
    .eq("status", "WAITING");

  const waitingCount = count ?? 0;

  let position: number | null = null;
  if (entry.status === "WAITING") {
    const { count: ahead } = await client
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("queue_id", entry.queue_id)
      .eq("business_date", entry.business_date)
      .eq("status", "WAITING")
      .lt("joined_at", entry.joined_at);
    position = (ahead ?? 0) + 1;
  }

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    branchId: branch.id,
    branchName: branch.name,
    queueId: queue.id,
    queueName: queue.name,
    entry: {
      id: entry.id,
      queue_id: entry.queue_id,
      customer_id: entry.customer_id,
      table_id: entry.table_id,
      token: entry.token,
      business_date: entry.business_date,
      party_size: entry.party_size,
      status: entry.status,
      joined_at: entry.joined_at,
      called_at: entry.called_at,
      seated_at: entry.seated_at,
      completed_at: entry.completed_at,
      cancelled_at: entry.cancelled_at,
      skipped_at: entry.skipped_at,
      no_show_at: entry.no_show_at,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    },
    customer,
    estimatedWaitMinutes: null,
    position,
    waitingCount,
  };
}

function templateFromContext(
  ctx: QueueNotificationContext,
): QueueNotificationTemplateData {
  return {
    customerName: ctx.customer?.name ?? "Guest",
    restaurantName: ctx.restaurantName,
    branchName: ctx.branchName,
    token: ctx.entry.token,
    partySize: ctx.entry.party_size,
    estimatedWait:
      ctx.estimatedWaitMinutes != null
        ? `${ctx.estimatedWaitMinutes} min`
        : null,
    position: ctx.position,
    queueName: ctx.queueName,
  };
}

function customerChannels(
  customer: QueueNotificationContext["customer"],
): Array<{ channel: NotificationChannel; recipient: string }> {
  if (!customer) return [];
  const channels: Array<{ channel: NotificationChannel; recipient: string }> =
    [];
  const email = customer.email?.trim() || "";
  const phone = customer.phone?.trim() || "";
  if (email) {
    channels.push({ channel: "EMAIL", recipient: email });
  }
  if (phone) {
    channels.push({ channel: "WHATSAPP", recipient: phone });
    channels.push({ channel: "SMS", recipient: phone });
  }
  channels.push({ channel: "IN_APP", recipient: customer.id });
  if (isWebPushConfigured()) {
    channels.push({ channel: "PUSH", recipient: customer.id });
  }
  return channels;
}

async function dispatchCustomerEvent(
  ctx: QueueNotificationContext,
  type:
    | "QUEUE_JOINED"
    | "QUEUE_CALLED"
    | "QUEUE_READY"
    | "QUEUE_SEATED"
    | "QUEUE_CANCELLED"
    | "QUEUE_NO_SHOW"
    | "QUEUE_REMINDER",
  eventVersion: string,
): Promise<void> {
  const data = templateFromContext(ctx);
  const channels = customerChannels(ctx.customer);

  if (!ctx.customer) {
    logNotificationEvent("missing_customer", {
      restaurantId: ctx.restaurantId,
      queueEntryId: ctx.entry.id,
      type,
      result: "skipped",
      errorCode: "MISSING_CONTACT",
    });
  } else if (!channels.some((c) => c.channel === "EMAIL")) {
    logNotificationEvent("missing_email", {
      restaurantId: ctx.restaurantId,
      queueEntryId: ctx.entry.id,
      type,
      channel: "EMAIL",
      result: "skipped",
      errorCode: "MISSING_CONTACT",
    });
  }

  await Promise.all(
    channels.map(({ channel, recipient }) =>
      sendNotification({
        restaurantId: ctx.restaurantId,
        customerId: ctx.customer?.id ?? null,
        queueEntryId: ctx.entry.id,
        branchId: ctx.branchId,
        type,
        channel,
        audience: "CUSTOMER",
        idempotencyKey: buildIdempotencyKey({
          queueEntryId: ctx.entry.id,
          type,
          channel,
          eventVersion,
        }),
        recipient,
        data,
      }),
    ),
  );
}

async function dispatchStaffEvent(
  ctx: QueueNotificationContext,
  type:
    | "STAFF_QUEUE_JOINED"
    | "STAFF_QUEUE_CALLED"
    | "STAFF_QUEUE_SEATED"
    | "STAFF_QUEUE_CANCELLED"
    | "STAFF_QUEUE_NO_SHOW"
    | "STAFF_QUEUE_BUSY",
  eventVersion: string,
  dataOverrides?: Partial<QueueNotificationTemplateData>,
): Promise<void> {
  const data = { ...templateFromContext(ctx), ...dataOverrides };
  const staffJobs = [
    sendNotification({
      restaurantId: ctx.restaurantId,
      customerId: ctx.customer?.id ?? null,
      queueEntryId: ctx.entry.id,
      branchId: ctx.branchId,
      type,
      channel: "IN_APP" as const,
      audience: "STAFF" as const,
      idempotencyKey: buildIdempotencyKey({
        queueEntryId: ctx.entry.id,
        type,
        channel: "IN_APP",
        eventVersion,
      }),
      recipient: `restaurant:${ctx.restaurantId}`,
      data,
    }),
  ];
  if (isWebPushConfigured()) {
    staffJobs.push(
      sendNotification({
        restaurantId: ctx.restaurantId,
        customerId: ctx.customer?.id ?? null,
        queueEntryId: ctx.entry.id,
        branchId: ctx.branchId,
        type,
        channel: "PUSH",
        audience: "STAFF",
        idempotencyKey: buildIdempotencyKey({
          queueEntryId: ctx.entry.id,
          type,
          channel: "PUSH",
          eventVersion,
        }),
        recipient: `restaurant:${ctx.restaurantId}`,
        data,
      }),
    );
  }
  await Promise.all(staffJobs);
}

/**
 * Queue notification orchestration.
 * Prefer awaiting these from server mutations so SMTP delivery completes
 * before the request ends. scheduleNotificationWork is a safe fallback.
 */
export async function notifyQueueJoined(entryId: string): Promise<void> {
  try {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) {
      logNotificationEvent("context_missing", {
        queueEntryId: entryId,
        type: "QUEUE_JOINED",
        result: "skipped",
        errorCode: "UNKNOWN",
      });
      return;
    }

    const version = ctx.entry.joined_at;
    await dispatchCustomerEvent(ctx, "QUEUE_JOINED", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_JOINED", version);

    const admin = createServiceRoleClient();
    const client = admin ?? (await createClient());
    const { data: settings } = await client
      .from("restaurant_settings")
      .select("notify_staff_queue_busy_threshold")
      .eq("restaurant_id", ctx.restaurantId)
      .maybeSingle();

    const threshold = settings?.notify_staff_queue_busy_threshold;
    if (
      typeof threshold === "number" &&
      threshold >= 1 &&
      ctx.waitingCount >= threshold
    ) {
      await dispatchStaffEvent(
        ctx,
        "STAFF_QUEUE_BUSY",
        `${ctx.entry.business_date}:${threshold}:${Math.floor(ctx.waitingCount / threshold)}`,
        { position: ctx.waitingCount },
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "notify_queue_joined_failed",
        queueEntryId: entryId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

export async function notifyQueueCalled(entryId: string): Promise<void> {
  try {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) {
      logNotificationEvent("context_missing", {
        queueEntryId: entryId,
        type: "QUEUE_CALLED",
        result: "skipped",
        errorCode: "UNKNOWN",
      });
      return;
    }
    const version = ctx.entry.called_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_CALLED", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_CALLED", version);
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "notify_queue_called_failed",
        queueEntryId: entryId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

export async function notifyQueueCancelled(entryId: string): Promise<void> {
  try {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;
    const version = ctx.entry.cancelled_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_CANCELLED", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_CANCELLED", version);
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "notify_queue_cancelled_failed",
        queueEntryId: entryId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

export async function notifyQueueNoShow(entryId: string): Promise<void> {
  try {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;
    const version = ctx.entry.no_show_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_NO_SHOW", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_NO_SHOW", version);
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "notify_queue_no_show_failed",
        queueEntryId: entryId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

export async function notifyQueueSeated(entryId: string): Promise<void> {
  try {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) {
      logNotificationEvent("context_missing", {
        queueEntryId: entryId,
        type: "QUEUE_SEATED",
        result: "skipped",
        errorCode: "UNKNOWN",
      });
      return;
    }
    const version = ctx.entry.seated_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_SEATED", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_SEATED", version);
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "notify_queue_seated_failed",
        queueEntryId: entryId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

/** Background-safe wrappers for callers that cannot await. */
export function notifyQueueJoinedDeferred(entryId: string): void {
  scheduleNotificationWork(() => notifyQueueJoined(entryId));
}

export function notifyQueueCalledDeferred(entryId: string): void {
  scheduleNotificationWork(() => notifyQueueCalled(entryId));
}

export function notifyQueueCancelledDeferred(entryId: string): void {
  scheduleNotificationWork(() => notifyQueueCancelled(entryId));
}

export function notifyQueueNoShowDeferred(entryId: string): void {
  scheduleNotificationWork(() => notifyQueueNoShow(entryId));
}

export function notifyQueueSeatedDeferred(entryId: string): void {
  scheduleNotificationWork(() => notifyQueueSeated(entryId));
}
