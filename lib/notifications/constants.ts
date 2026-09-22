import type {
  NotificationChannel,
  NotificationDeliveryErrorCode,
  NotificationType,
} from "@/lib/notifications/types";

/** Max provider attempts before permanently failing. */
export const NOTIFICATION_MAX_ATTEMPTS = 3;

/** Staff in-app feed page size. */
export const STAFF_NOTIFICATION_PAGE_SIZE = 20;

/** Default busy threshold when restaurant enables the feature without a value. */
export const DEFAULT_QUEUE_BUSY_THRESHOLD = 10;

export const RETRYABLE_ERROR_CODES: ReadonlySet<NotificationDeliveryErrorCode> =
  new Set(["PROVIDER_ERROR", "TIMEOUT", "RATE_LIMITED", "UNKNOWN"]);

export const NON_RETRYABLE_ERROR_CODES: ReadonlySet<NotificationDeliveryErrorCode> =
  new Set([
    "NOT_CONFIGURED",
    "INVALID_RECIPIENT",
    "REJECTED",
    "OPT_OUT",
    "MISSING_CONTACT",
    "VALIDATION",
  ]);

export const CHANNEL_PROVIDER_LABEL: Record<NotificationChannel, string> = {
  EMAIL: "resend",
  WHATSAPP: "whatsapp_cloud",
  SMS: "sms",
  IN_APP: "in_app",
  PUSH: "web_push",
};

export const CUSTOMER_TYPE_PREFERENCE_KEY = {
  QUEUE_JOINED: "notifyQueueJoined",
  QUEUE_CALLED: "notifyQueueCalled",
  QUEUE_REMINDER: "notifyQueueReminder",
  QUEUE_READY: "notifyQueueCalled",
  QUEUE_SEATED: "notifyQueueCalled",
  QUEUE_CANCELLED: "notifyQueueJoined",
  QUEUE_NO_SHOW: "notifyQueueJoined",
  RESERVATION_CREATED: "notifyQueueJoined",
  RESERVATION_CONFIRMED: "notifyQueueJoined",
  RESERVATION_REMINDER: "notifyQueueReminder",
  RESERVATION_CANCELLED: "notifyQueueJoined",
  RESERVATION_ARRIVED: "notifyQueueCalled",
  RESERVATION_SEATED: "notifyQueueCalled",
  RESERVATION_NO_SHOW: "notifyQueueJoined",
} as const satisfies Partial<
  Record<NotificationType, "notifyQueueJoined" | "notifyQueueCalled" | "notifyQueueReminder">
>;

export function buildIdempotencyKey(parts: {
  queueEntryId: string;
  type: NotificationType;
  channel: NotificationChannel;
  eventVersion: string;
}): string {
  return [
    parts.queueEntryId,
    parts.type,
    parts.channel,
    parts.eventVersion,
  ].join(":");
}
