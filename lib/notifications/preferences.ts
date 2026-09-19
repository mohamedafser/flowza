import type {
  CustomerNotificationPreferences,
  CustomerNotificationType,
  NotificationChannel,
  RestaurantNotificationSettings,
} from "@/lib/notifications/types";
import { CUSTOMER_TYPE_PREFERENCE_KEY } from "@/lib/notifications/constants";

export const DEFAULT_CUSTOMER_PREFERENCES: CustomerNotificationPreferences = {
  emailEnabled: true,
  whatsappEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  notifyQueueJoined: true,
  notifyQueueCalled: true,
  notifyQueueReminder: true,
};

export const DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS: RestaurantNotificationSettings =
  {
    notificationsEmailEnabled: false,
    notificationsWhatsappEnabled: false,
    notificationsSmsEnabled: false,
    notificationsInAppEnabled: true,
    notifyCustomerOnJoin: true,
    notifyCustomerOnCalled: true,
    notifyCustomerOnReminder: false,
    notifyStaffOnJoin: true,
    notifyStaffOnCancel: true,
    notifyStaffOnNoShow: true,
    notifyStaffQueueBusyThreshold: null,
  };

export function channelEnabledForCustomer(
  channel: NotificationChannel,
  prefs: CustomerNotificationPreferences,
): boolean {
  switch (channel) {
    case "EMAIL":
      return prefs.emailEnabled;
    case "WHATSAPP":
      return prefs.whatsappEnabled;
    case "SMS":
      return prefs.smsEnabled;
    case "IN_APP":
      return prefs.inAppEnabled;
    default: {
      const _exhaustive: never = channel;
      void _exhaustive;
      return false;
    }
  }
}

export function typeEnabledForCustomer(
  type: CustomerNotificationType,
  prefs: CustomerNotificationPreferences,
): boolean {
  const key = CUSTOMER_TYPE_PREFERENCE_KEY[type];
  if (!key) return true;
  return prefs[key];
}

export function channelEnabledForRestaurant(
  channel: NotificationChannel,
  settings: RestaurantNotificationSettings,
): boolean {
  switch (channel) {
    case "EMAIL":
      return settings.notificationsEmailEnabled;
    case "WHATSAPP":
      return settings.notificationsWhatsappEnabled;
    case "SMS":
      return settings.notificationsSmsEnabled;
    case "IN_APP":
      return settings.notificationsInAppEnabled;
    default: {
      const _exhaustive: never = channel;
      void _exhaustive;
      return false;
    }
  }
}

export function mapRestaurantNotificationSettings(row: {
  notifications_email_enabled?: boolean | null;
  notifications_whatsapp_enabled?: boolean | null;
  notifications_sms_enabled?: boolean | null;
  notifications_in_app_enabled?: boolean | null;
  notify_customer_on_join?: boolean | null;
  notify_customer_on_called?: boolean | null;
  notify_customer_on_reminder?: boolean | null;
  notify_staff_on_join?: boolean | null;
  notify_staff_on_cancel?: boolean | null;
  notify_staff_on_no_show?: boolean | null;
  notify_staff_queue_busy_threshold?: number | null;
}): RestaurantNotificationSettings {
  return {
    notificationsEmailEnabled:
      row.notifications_email_enabled ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notificationsEmailEnabled,
    notificationsWhatsappEnabled:
      row.notifications_whatsapp_enabled ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notificationsWhatsappEnabled,
    notificationsSmsEnabled:
      row.notifications_sms_enabled ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notificationsSmsEnabled,
    notificationsInAppEnabled:
      row.notifications_in_app_enabled ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notificationsInAppEnabled,
    notifyCustomerOnJoin:
      row.notify_customer_on_join ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notifyCustomerOnJoin,
    notifyCustomerOnCalled:
      row.notify_customer_on_called ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notifyCustomerOnCalled,
    notifyCustomerOnReminder:
      row.notify_customer_on_reminder ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notifyCustomerOnReminder,
    notifyStaffOnJoin:
      row.notify_staff_on_join ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notifyStaffOnJoin,
    notifyStaffOnCancel:
      row.notify_staff_on_cancel ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notifyStaffOnCancel,
    notifyStaffOnNoShow:
      row.notify_staff_on_no_show ??
      DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS.notifyStaffOnNoShow,
    notifyStaffQueueBusyThreshold:
      row.notify_staff_queue_busy_threshold ?? null,
  };
}

export function mapCustomerPreferences(row: {
  email_enabled?: boolean | null;
  whatsapp_enabled?: boolean | null;
  sms_enabled?: boolean | null;
  in_app_enabled?: boolean | null;
  notify_queue_joined?: boolean | null;
  notify_queue_called?: boolean | null;
  notify_queue_reminder?: boolean | null;
} | null): CustomerNotificationPreferences {
  if (!row) {
    return { ...DEFAULT_CUSTOMER_PREFERENCES };
  }

  return {
    emailEnabled: row.email_enabled ?? DEFAULT_CUSTOMER_PREFERENCES.emailEnabled,
    whatsappEnabled:
      row.whatsapp_enabled ?? DEFAULT_CUSTOMER_PREFERENCES.whatsappEnabled,
    smsEnabled: row.sms_enabled ?? DEFAULT_CUSTOMER_PREFERENCES.smsEnabled,
    inAppEnabled:
      row.in_app_enabled ?? DEFAULT_CUSTOMER_PREFERENCES.inAppEnabled,
    notifyQueueJoined:
      row.notify_queue_joined ?? DEFAULT_CUSTOMER_PREFERENCES.notifyQueueJoined,
    notifyQueueCalled:
      row.notify_queue_called ?? DEFAULT_CUSTOMER_PREFERENCES.notifyQueueCalled,
    notifyQueueReminder:
      row.notify_queue_reminder ??
      DEFAULT_CUSTOMER_PREFERENCES.notifyQueueReminder,
  };
}
