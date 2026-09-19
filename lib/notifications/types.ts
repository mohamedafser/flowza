/**
 * Central notification types for Flowza Phase 13.
 * Keep payloads typed and extensible without leaking provider shapes.
 */

export const NOTIFICATION_CHANNELS = [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "IN_APP",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "FAILED",
  "CANCELLED",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_AUDIENCES = ["CUSTOMER", "STAFF"] as const;

export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export const CUSTOMER_NOTIFICATION_TYPES = [
  "QUEUE_JOINED",
  "QUEUE_CALLED",
  "QUEUE_REMINDER",
  "QUEUE_READY",
  "QUEUE_SEATED",
  "QUEUE_CANCELLED",
  "QUEUE_NO_SHOW",
  "RESERVATION_CREATED",
  "RESERVATION_CONFIRMED",
  "RESERVATION_REMINDER",
  "RESERVATION_CANCELLED",
  "RESERVATION_ARRIVED",
  "RESERVATION_SEATED",
  "RESERVATION_NO_SHOW",
] as const;

export type CustomerNotificationType =
  (typeof CUSTOMER_NOTIFICATION_TYPES)[number];

export const STAFF_NOTIFICATION_TYPES = [
  "STAFF_QUEUE_JOINED",
  "STAFF_QUEUE_CANCELLED",
  "STAFF_QUEUE_NO_SHOW",
  "STAFF_QUEUE_BUSY",
  "STAFF_RESERVATION_CREATED",
  "STAFF_RESERVATION_CANCELLED",
  "STAFF_RESERVATION_NO_SHOW",
] as const;

export type StaffNotificationType = (typeof STAFF_NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPES = [
  ...CUSTOMER_NOTIFICATION_TYPES,
  ...STAFF_NOTIFICATION_TYPES,
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type QueueNotificationTemplateData = {
  customerName: string;
  restaurantName: string;
  branchName: string;
  token: string;
  partySize: number;
  estimatedWait: string | null;
  position: number | null;
  queueName: string;
};

export type ReservationNotificationTemplateData = {
  customerName: string;
  restaurantName: string;
  branchName: string;
  reservationCode: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  tableName: string | null;
};

export type RenderedTemplate = {
  title: string;
  body: string;
  subject?: string;
};

export type NotificationProviderName =
  | "resend"
  | "whatsapp_cloud"
  | "sms"
  | "in_app"
  | "none";

export type NotificationDeliveryErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_RECIPIENT"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "REJECTED"
  | "OPT_OUT"
  | "MISSING_CONTACT"
  | "VALIDATION"
  | "UNKNOWN";

export type NotificationResult = {
  ok: boolean;
  provider: NotificationProviderName;
  providerMessageId?: string;
  retryable: boolean;
  errorCode?: NotificationDeliveryErrorCode;
  errorMessage?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SmsMessage = {
  to: string;
  body: string;
};

export type WhatsAppMessage = {
  to: string;
  body: string;
};

export type InAppMessage = {
  recipient: string;
  title: string;
  body: string;
};

export type SendNotificationInput = {
  restaurantId: string;
  customerId?: string | null;
  queueEntryId?: string | null;
  reservationId?: string | null;
  branchId?: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  audience?: NotificationAudience;
  /** Stable key for deduplication. Required for queue-driven events. */
  idempotencyKey: string;
  recipient: string;
  data:
    | QueueNotificationTemplateData
    | ReservationNotificationTemplateData
    | Record<string, string | number | null>;
  /** Optional event version (e.g. called_at) already baked into idempotencyKey. */
  eventVersion?: string;
  scheduledAt?: string | null;
  /** Skip preference checks for system-critical operational messages. */
  bypassPreferences?: boolean;
};

export type CustomerNotificationPreferences = {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  notifyQueueJoined: boolean;
  notifyQueueCalled: boolean;
  notifyQueueReminder: boolean;
};

export type RestaurantNotificationSettings = {
  notificationsEmailEnabled: boolean;
  notificationsWhatsappEnabled: boolean;
  notificationsSmsEnabled: boolean;
  notificationsInAppEnabled: boolean;
  notifyCustomerOnJoin: boolean;
  notifyCustomerOnCalled: boolean;
  notifyCustomerOnReminder: boolean;
  notifyStaffOnJoin: boolean;
  notifyStaffOnCancel: boolean;
  notifyStaffOnNoShow: boolean;
  notifyStaffQueueBusyThreshold: number | null;
};
