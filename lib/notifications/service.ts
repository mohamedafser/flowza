import { z } from "zod";
import {
  NOTIFICATION_MAX_ATTEMPTS,
  RETRYABLE_ERROR_CODES,
} from "@/lib/notifications/constants";
import {
  createDefaultProviders,
  dispatchNotification,
  type NotificationProviders,
} from "@/lib/notifications/dispatcher";
import { logNotificationEvent } from "@/lib/notifications/log";
import {
  channelEnabledForCustomer,
  channelEnabledForRestaurant,
  mapCustomerPreferences,
  mapRestaurantNotificationSettings,
  typeEnabledForCustomer,
} from "@/lib/notifications/preferences";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { renderNotificationTemplate } from "@/lib/notifications/templates";
import {
  CUSTOMER_NOTIFICATION_TYPES,
} from "@/lib/notifications/types";
import type {
  CustomerNotificationType,
  NotificationAudience,
  NotificationChannel,
  NotificationResult,
  QueueNotificationTemplateData,
  SendNotificationInput,
} from "@/lib/notifications/types";
import type { Json, Tables } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type NotificationRecord = Tables<"notifications">;

export type SendNotificationOutcome =
  | {
      status: "sent" | "failed" | "pending" | "duplicate" | "skipped";
      notification: NotificationRecord | null;
      result?: NotificationResult;
      reason?: string;
    };

const notificationTypeSchema = z.enum([
  "QUEUE_JOINED",
  "QUEUE_CALLED",
  "QUEUE_REMINDER",
  "QUEUE_READY",
  "QUEUE_SEATED",
  "QUEUE_CANCELLED",
  "QUEUE_NO_SHOW",
  "STAFF_QUEUE_JOINED",
  "STAFF_QUEUE_CANCELLED",
  "STAFF_QUEUE_NO_SHOW",
  "STAFF_QUEUE_BUSY",
  "RESERVATION_CREATED",
  "RESERVATION_CONFIRMED",
  "RESERVATION_REMINDER",
  "RESERVATION_CANCELLED",
  "RESERVATION_ARRIVED",
  "RESERVATION_SEATED",
  "RESERVATION_NO_SHOW",
  "STAFF_RESERVATION_CREATED",
  "STAFF_RESERVATION_CANCELLED",
  "STAFF_RESERVATION_NO_SHOW",
]);

const notificationChannelSchema = z.enum(["EMAIL", "SMS", "WHATSAPP", "IN_APP"]);

const sendInputSchema = z.object({
  restaurantId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  queueEntryId: z.string().uuid().nullable().optional(),
  reservationId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  type: notificationTypeSchema,
  channel: notificationChannelSchema,
  audience: z.enum(["CUSTOMER", "STAFF"]).optional(),
  idempotencyKey: z.string().min(8).max(200),
  recipient: z.string().min(1).max(320),
  bypassPreferences: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

function isCustomerType(type: string): type is CustomerNotificationType {
  return (CUSTOMER_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

function asTemplateData(
  data: SendNotificationInput["data"],
): QueueNotificationTemplateData & Record<string, string | number | null> {
  return {
    customerName: String(data.customerName ?? "Guest"),
    restaurantName: String(data.restaurantName ?? "Restaurant"),
    branchName: String(data.branchName ?? ""),
    token: String(
      "token" in data && data.token != null
        ? data.token
        : "reservationCode" in data && data.reservationCode != null
          ? data.reservationCode
          : "",
    ),
    partySize: Number(data.partySize ?? 1),
    estimatedWait:
      "estimatedWait" in data && data.estimatedWait != null
        ? String(data.estimatedWait)
        : null,
    position:
      "position" in data && data.position != null && data.position !== ""
        ? Number(data.position)
        : null,
    queueName: String(
      "queueName" in data && data.queueName != null ? data.queueName : "Queue",
    ),
    reservationCode: String(
      "reservationCode" in data && data.reservationCode != null
        ? data.reservationCode
        : "",
    ),
    reservationDate: String(
      "reservationDate" in data && data.reservationDate != null
        ? data.reservationDate
        : "",
    ),
    reservationTime: String(
      "reservationTime" in data && data.reservationTime != null
        ? data.reservationTime
        : "",
    ),
    tableName:
      "tableName" in data && data.tableName != null
        ? String(data.tableName)
        : null,
  };
}

async function resolveDbClient(
  preferred?: SupabaseClient<Database>,
): Promise<SupabaseClient<Database>> {
  if (preferred) return preferred;
  const admin = createServiceRoleClient();
  if (admin) return admin;
  return createClient();
}

function safePayload(
  data: QueueNotificationTemplateData & Record<string, string | number | null>,
): Record<string, Json> {
  return {
    token: data.token,
    partySize: data.partySize,
    estimatedWait: data.estimatedWait,
    position: data.position,
    restaurantName: data.restaurantName,
    branchName: data.branchName,
    queueName: data.queueName,
    reservationCode:
      typeof data.reservationCode === "string" ? data.reservationCode : null,
    reservationDate:
      typeof data.reservationDate === "string" ? data.reservationDate : null,
    reservationTime:
      typeof data.reservationTime === "string" ? data.reservationTime : null,
    tableName: typeof data.tableName === "string" ? data.tableName : null,
    // Intentionally omit customerName from stored payload for privacy.
  };
}

async function loadRestaurantSettings(
  client: SupabaseClient<Database>,
  restaurantId: string,
) {
  const { data } = await client
    .from("restaurant_settings")
    .select(
      "notifications_email_enabled, notifications_whatsapp_enabled, notifications_sms_enabled, notifications_in_app_enabled, notify_customer_on_join, notify_customer_on_called, notify_customer_on_reminder, notify_staff_on_join, notify_staff_on_cancel, notify_staff_on_no_show, notify_staff_queue_busy_threshold",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return mapRestaurantNotificationSettings(data ?? {});
}

async function loadCustomerPreferences(
  client: SupabaseClient<Database>,
  customerId: string | null | undefined,
) {
  if (!customerId) {
    return mapCustomerPreferences(null);
  }

  const { data } = await client
    .from("customer_notification_preferences")
    .select(
      "email_enabled, whatsapp_enabled, sms_enabled, in_app_enabled, notify_queue_joined, notify_queue_called, notify_queue_reminder",
    )
    .eq("customer_id", customerId)
    .maybeSingle();

  return mapCustomerPreferences(data);
}

function shouldSkipByPreferences(input: {
  type: SendNotificationInput["type"];
  channel: NotificationChannel;
  audience: NotificationAudience;
  bypassPreferences?: boolean;
  restaurantSettings: ReturnType<typeof mapRestaurantNotificationSettings>;
  customerPreferences: ReturnType<typeof mapCustomerPreferences>;
}): string | null {
  if (input.bypassPreferences) {
    return null;
  }

  if (!channelEnabledForRestaurant(input.channel, input.restaurantSettings)) {
    return "channel_disabled_by_restaurant";
  }

  if (input.audience === "CUSTOMER" && isCustomerType(input.type)) {
    if (input.type === "QUEUE_JOINED" && !input.restaurantSettings.notifyCustomerOnJoin) {
      return "customer_join_disabled";
    }
    if (
      (input.type === "QUEUE_CALLED" || input.type === "QUEUE_READY") &&
      !input.restaurantSettings.notifyCustomerOnCalled
    ) {
      return "customer_called_disabled";
    }
    if (
      input.type === "QUEUE_REMINDER" &&
      !input.restaurantSettings.notifyCustomerOnReminder
    ) {
      return "customer_reminder_disabled";
    }

    if (!channelEnabledForCustomer(input.channel, input.customerPreferences)) {
      return "channel_opt_out";
    }
    if (!typeEnabledForCustomer(input.type, input.customerPreferences)) {
      return "type_opt_out";
    }
  }

  if (input.audience === "STAFF") {
    if (
      input.type === "STAFF_QUEUE_JOINED" &&
      !input.restaurantSettings.notifyStaffOnJoin
    ) {
      return "staff_join_disabled";
    }
    if (
      input.type === "STAFF_QUEUE_CANCELLED" &&
      !input.restaurantSettings.notifyStaffOnCancel
    ) {
      return "staff_cancel_disabled";
    }
    if (
      input.type === "STAFF_QUEUE_NO_SHOW" &&
      !input.restaurantSettings.notifyStaffOnNoShow
    ) {
      return "staff_no_show_disabled";
    }
  }

  return null;
}

async function markDelivery(
  client: SupabaseClient<Database>,
  notificationId: string,
  result: NotificationResult,
  attempts: number,
): Promise<NotificationRecord | null> {
  const nextStatus = result.ok
    ? "SENT"
    : result.retryable && attempts + 1 < NOTIFICATION_MAX_ATTEMPTS
      ? "PENDING"
      : "FAILED";

  const { data, error } = await client.rpc("notification_mark_delivery", {
    p_notification_id: notificationId,
    p_status: nextStatus,
    p_provider: result.provider,
    p_provider_message_id: result.providerMessageId ?? null,
    p_error_code: result.errorCode ?? null,
    p_error_message: result.errorMessage ?? null,
    p_increment_attempt: true,
  });

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Core notification API. Validates, checks preferences, enqueues with
 * idempotency, dispatches via providers, and records delivery status.
 * Never throws for provider failures — returns a structured outcome.
 */
export async function sendNotification(
  input: SendNotificationInput,
  options?: {
    client?: SupabaseClient<Database>;
    providers?: NotificationProviders;
    /** When true, only create the row (for deferred/background workers). */
    enqueueOnly?: boolean;
  },
): Promise<SendNotificationOutcome> {
  const parsed = sendInputSchema.safeParse(input);
  if (!parsed.success) {
    logNotificationEvent("validation_failed", {
      restaurantId: input.restaurantId,
      type: input.type,
      channel: input.channel,
      result: "skipped",
      errorCode: "VALIDATION",
    });
    return {
      status: "skipped",
      notification: null,
      reason: "validation_failed",
    };
  }

  const audience: NotificationAudience =
    input.audience ??
    (input.type.startsWith("STAFF_") ? "STAFF" : "CUSTOMER");

  const client = await resolveDbClient(options?.client);
  const restaurantSettings = await loadRestaurantSettings(
    client,
    parsed.data.restaurantId,
  );
  const customerPreferences = await loadCustomerPreferences(
    client,
    parsed.data.customerId,
  );

  const skipReason = shouldSkipByPreferences({
    type: parsed.data.type,
    channel: parsed.data.channel,
    audience,
    bypassPreferences: parsed.data.bypassPreferences,
    restaurantSettings,
    customerPreferences,
  });

  if (skipReason) {
    logNotificationEvent("preference_skip", {
      restaurantId: parsed.data.restaurantId,
      queueEntryId: parsed.data.queueEntryId,
      type: parsed.data.type,
      channel: parsed.data.channel,
      result: "skipped",
      errorCode: skipReason === "channel_opt_out" ? "OPT_OUT" : "VALIDATION",
    });
    return { status: "skipped", notification: null, reason: skipReason };
  }

  const templateData = asTemplateData(input.data);
  const rendered = renderNotificationTemplate(
    parsed.data.type,
    parsed.data.channel,
    templateData,
  );

  const { data: enqueued, error: enqueueError } = await client.rpc(
    "notification_enqueue",
    {
      p_restaurant_id: parsed.data.restaurantId,
      p_channel: parsed.data.channel,
      p_type: parsed.data.type,
      p_recipient: parsed.data.recipient,
      p_payload: safePayload(templateData),
      p_customer_id: parsed.data.customerId ?? null,
      p_queue_entry_id: parsed.data.queueEntryId ?? null,
      p_reservation_id: parsed.data.reservationId ?? null,
      p_branch_id: parsed.data.branchId ?? null,
      p_audience: audience,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_title: rendered.title,
      p_body: rendered.body,
      p_provider: null,
      p_scheduled_at: parsed.data.scheduledAt ?? null,
    },
  );

  if (enqueueError || !enqueued) {
    logNotificationEvent("enqueue_failed", {
      restaurantId: parsed.data.restaurantId,
      queueEntryId: parsed.data.queueEntryId,
      type: parsed.data.type,
      channel: parsed.data.channel,
      result: "failed",
      errorCode: "UNKNOWN",
    });
    return {
      status: "failed",
      notification: null,
      reason: "enqueue_failed",
    };
  }

  // Duplicate: already terminal or in-flight
  if (enqueued.status === "SENT" || enqueued.status === "CANCELLED") {
    logNotificationEvent("duplicate", {
      notificationId: enqueued.id,
      restaurantId: parsed.data.restaurantId,
      queueEntryId: parsed.data.queueEntryId,
      type: parsed.data.type,
      channel: parsed.data.channel,
      result: "duplicate",
    });
    return { status: "duplicate", notification: enqueued };
  }

  if (enqueued.attempts >= NOTIFICATION_MAX_ATTEMPTS) {
    return { status: "failed", notification: enqueued, reason: "max_attempts" };
  }

  if (options?.enqueueOnly) {
    return { status: "pending", notification: enqueued };
  }

  // Claim exclusive dispatch rights (prevents duplicate provider sends)
  const { data: claimed, error: claimError } = await client.rpc(
    "notification_claim",
    { p_notification_id: enqueued.id },
  );

  if (claimError || !claimed) {
    logNotificationEvent("duplicate", {
      notificationId: enqueued.id,
      restaurantId: parsed.data.restaurantId,
      queueEntryId: parsed.data.queueEntryId,
      type: parsed.data.type,
      channel: parsed.data.channel,
      result: "duplicate",
    });
    return { status: "duplicate", notification: enqueued };
  }

  const result = await dispatchNotification({
    channel: parsed.data.channel,
    recipient: parsed.data.recipient,
    template: rendered,
    providers: options?.providers ?? createDefaultProviders(),
  });

  const updated = await markDelivery(
    client,
    enqueued.id,
    result,
    claimed.attempts,
  );

  logNotificationEvent("dispatch", {
    notificationId: enqueued.id,
    restaurantId: parsed.data.restaurantId,
    queueEntryId: parsed.data.queueEntryId,
    type: parsed.data.type,
    channel: parsed.data.channel,
    provider: result.provider,
    attempt: (enqueued.attempts ?? 0) + 1,
    result: result.ok ? "sent" : "failed",
    errorCode: result.errorCode,
    recipientHint: parsed.data.recipient,
  });

  if (result.ok) {
    return { status: "sent", notification: updated ?? enqueued, result };
  }

  const retryable =
    result.retryable && RETRYABLE_ERROR_CODES.has(result.errorCode ?? "UNKNOWN");

  return {
    status: retryable ? "pending" : "failed",
    notification: updated ?? enqueued,
    result,
    reason: result.errorCode,
  };
}

/**
 * Schedule notification work without blocking the caller.
 * Uses Next.js `after` when available; otherwise fire-and-forget.
 */
export function scheduleNotificationWork(work: () => Promise<void>): void {
  void (async () => {
    try {
      const nextServer = await import("next/server");
      if (typeof nextServer.after === "function") {
        nextServer.after(() => {
          void work().catch(() => {
            // Isolation: notification failures must never surface to users.
          });
        });
        return;
      }
    } catch {
      // Not in a Next.js request context (tests / scripts).
    }

    void work().catch(() => {
      // Isolation: notification failures must never surface to users.
    });
  })();
}
