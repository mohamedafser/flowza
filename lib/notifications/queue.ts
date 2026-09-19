import { buildIdempotencyKey } from "@/lib/notifications/constants";
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
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());

  const { data: entry, error } = await client
    .from("queue_entries")
    .select(
      "id, queue_id, customer_id, table_id, token, business_date, party_size, status, joined_at, called_at, seated_at, completed_at, cancelled_at, skipped_at, no_show_at, created_at, updated_at",
    )
    .eq("id", entryId)
    .maybeSingle();

  if (error || !entry) {
    return null;
  }

  const { data: queue } = await client
    .from("queues")
    .select("id, name, branch_id")
    .eq("id", entry.queue_id)
    .maybeSingle();

  if (!queue) {
    return null;
  }

  const { data: branch } = await client
    .from("branches")
    .select("id, name, restaurant_id")
    .eq("id", queue.branch_id)
    .maybeSingle();

  if (!branch) {
    return null;
  }

  const { data: restaurant } = await client
    .from("restaurants")
    .select("id, name")
    .eq("id", branch.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
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
  if (customer.email) {
    channels.push({ channel: "EMAIL", recipient: customer.email });
  }
  if (customer.phone) {
    channels.push({ channel: "WHATSAPP", recipient: customer.phone });
    channels.push({ channel: "SMS", recipient: customer.phone });
  }
  channels.push({ channel: "IN_APP", recipient: customer.id });
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

  for (const { channel, recipient } of channels) {
    await sendNotification({
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
    });
  }
}

async function dispatchStaffEvent(
  ctx: QueueNotificationContext,
  type:
    | "STAFF_QUEUE_JOINED"
    | "STAFF_QUEUE_CANCELLED"
    | "STAFF_QUEUE_NO_SHOW"
    | "STAFF_QUEUE_BUSY",
  eventVersion: string,
  dataOverrides?: Partial<QueueNotificationTemplateData>,
): Promise<void> {
  const data = { ...templateFromContext(ctx), ...dataOverrides };
  await sendNotification({
    restaurantId: ctx.restaurantId,
    customerId: ctx.customer?.id ?? null,
    queueEntryId: ctx.entry.id,
    branchId: ctx.branchId,
    type,
    channel: "IN_APP",
    audience: "STAFF",
    idempotencyKey: buildIdempotencyKey({
      queueEntryId: ctx.entry.id,
      type,
      channel: "IN_APP",
      eventVersion,
    }),
    recipient: `restaurant:${ctx.restaurantId}`,
    data,
  });
}

/**
 * Fire-and-forget queue notification orchestration.
 * Safe to call after successful queue mutations; never throws to callers.
 */
export function notifyQueueJoined(entryId: string): void {
  scheduleNotificationWork(async () => {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;

    const version = ctx.entry.joined_at;
    await dispatchCustomerEvent(ctx, "QUEUE_JOINED", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_JOINED", version);

    const { data: settings } = await (
      createServiceRoleClient() ?? (await createClient())
    )
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
  });
}

export function notifyQueueCalled(entryId: string): void {
  scheduleNotificationWork(async () => {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;
    const version = ctx.entry.called_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_CALLED", version);
  });
}

export function notifyQueueCancelled(entryId: string): void {
  scheduleNotificationWork(async () => {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;
    const version = ctx.entry.cancelled_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_CANCELLED", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_CANCELLED", version);
  });
}

export function notifyQueueNoShow(entryId: string): void {
  scheduleNotificationWork(async () => {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;
    const version = ctx.entry.no_show_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_NO_SHOW", version);
    await dispatchStaffEvent(ctx, "STAFF_QUEUE_NO_SHOW", version);
  });
}

export function notifyQueueSeated(entryId: string): void {
  scheduleNotificationWork(async () => {
    const ctx = await loadQueueNotificationContext(entryId);
    if (!ctx) return;
    const version = ctx.entry.seated_at ?? ctx.entry.updated_at;
    await dispatchCustomerEvent(ctx, "QUEUE_SEATED", version);
  });
}
