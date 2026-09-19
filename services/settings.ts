import {
  requirePermission,
  requireRestaurantMembership,
} from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import type {
  CustomerExperienceValues,
  GeneralSettingsValues,
  QueueSettingsValues,
} from "@/lib/validations/settings";
import type { NotificationSettingsValues } from "@/lib/validations/notifications";
import { toRestaurantPayload } from "@/lib/validations/restaurant";
import { writeAuditLog } from "@/services/audit";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type RestaurantSettings = Tables<"restaurant_settings">;

export type SettingsMutationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      message: string;
      code: "FORBIDDEN" | "NOT_FOUND" | "UNKNOWN";
    };

const SETTINGS_SELECT = "*";

export async function getRestaurantSettings(
  restaurantId: string,
): Promise<RestaurantSettings | null> {
  await requireRestaurantMembership(restaurantId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select(SETTINGS_SELECT)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return null;
  }

  if (data) {
    return data;
  }

  const { data: created, error: insertError } = await supabase
    .from("restaurant_settings")
    .insert({ restaurant_id: restaurantId })
    .select(SETTINGS_SELECT)
    .maybeSingle();

  if (insertError || !created) {
    return null;
  }

  return created;
}

async function persistSettings(
  restaurantId: string,
  patch: Partial<RestaurantSettings>,
): Promise<SettingsMutationResult<RestaurantSettings>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_settings")
    .update(patch)
    .eq("restaurant_id", restaurantId)
    .select(SETTINGS_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update settings. Please try again.",
      ),
    };
  }

  if (!data) {
    const inserted = await supabase
      .from("restaurant_settings")
      .insert({ restaurant_id: restaurantId, ...patch })
      .select(SETTINGS_SELECT)
      .maybeSingle();

    if (inserted.error || !inserted.data) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Restaurant settings were not found.",
      };
    }

    return { ok: true, data: inserted.data };
  }

  return { ok: true, data };
}

export async function updateRestaurantSettings(
  restaurantId: string,
  patch: Partial<RestaurantSettings>,
): Promise<SettingsMutationResult<RestaurantSettings>> {
  await requirePermission(restaurantId, "restaurant.manage");
  return persistSettings(restaurantId, patch);
}

export async function updateGeneralSettings(
  restaurantId: string,
  input: GeneralSettingsValues,
): Promise<
  SettingsMutationResult<{
    restaurantId: string;
    settings: RestaurantSettings;
  }>
> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const restaurantPayload = toRestaurantPayload(input);
  const supabase = await createClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .update({
      name: restaurantPayload.name,
      email: restaurantPayload.email,
      phone: restaurantPayload.phone,
      website: restaurantPayload.website,
      description: restaurantPayload.description,
      timezone: restaurantPayload.timezone,
    })
    .eq("id", restaurantId)
    .select("id, timezone")
    .maybeSingle();

  if (restaurantError) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        restaurantError,
        "Unable to update restaurant settings. Please try again.",
      ),
    };
  }

  if (!restaurant) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Restaurant not found.",
    };
  }

  await supabase
    .from("branches")
    .update({ timezone: restaurant.timezone })
    .eq("restaurant_id", restaurantId)
    .eq("use_restaurant_timezone", true);

  const settingsResult = await persistSettings(restaurantId, {
    date_format: input.dateFormat,
    time_format: input.timeFormat,
  });

  if (!settingsResult.ok) {
    return settingsResult;
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "restaurant.settings_updated",
    entityType: "restaurant",
    entityId: restaurantId,
    metadata: {
      name: restaurantPayload.name,
      timezone: restaurantPayload.timezone,
      dateFormat: input.dateFormat,
      timeFormat: input.timeFormat,
    },
  });

  return { ok: true, data: { restaurantId, settings: settingsResult.data } };
}

export async function updateQueueSettings(
  restaurantId: string,
  input: QueueSettingsValues,
): Promise<SettingsMutationResult<RestaurantSettings>> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const result = await persistSettings(restaurantId, {
    queue_enabled: input.queueEnabled,
    default_queue_name: input.defaultQueueName,
    token_prefix: input.tokenPrefix,
    starting_token_number: input.startingTokenNumber,
    default_service_minutes: input.defaultServiceMinutes,
    max_queue_capacity: input.maxQueueCapacity,
    allow_walk_ins: input.allowWalkIns,
    allow_self_check_in: input.allowSelfCheckIn,
    allow_manual_entry: input.allowManualEntry,
    show_estimated_wait: input.showEstimatedWait,
    show_queue_position: input.showQueuePosition,
  });

  if (!result.ok) {
    return result;
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "restaurant.queue_settings_updated",
    entityType: "restaurant_settings",
    entityId: restaurantId,
    metadata: {
      queueEnabled: input.queueEnabled,
      tokenPrefix: input.tokenPrefix,
      maxQueueCapacity: input.maxQueueCapacity,
    },
  });

  return result;
}

export async function updateCustomerExperienceSettings(
  restaurantId: string,
  input: CustomerExperienceValues,
): Promise<SettingsMutationResult<RestaurantSettings>> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const result = await persistSettings(restaurantId, {
    show_estimated_wait: input.showEstimatedWait,
    show_queue_position: input.showQueuePosition,
    show_party_size: input.showPartySize,
    allow_customer_cancel: input.allowCustomerCancel,
    allow_self_check_in: input.allowSelfCheckIn,
    require_customer_name: input.requireCustomerName,
    require_customer_phone: input.requireCustomerPhone,
  });

  if (!result.ok) {
    return result;
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "restaurant.customer_settings_updated",
    entityType: "restaurant_settings",
    entityId: restaurantId,
    metadata: {
      showEstimatedWait: input.showEstimatedWait,
      showQueuePosition: input.showQueuePosition,
      allowSelfCheckIn: input.allowSelfCheckIn,
    },
  });

  return result;
}

export async function updateNotificationSettings(
  restaurantId: string,
  input: NotificationSettingsValues,
): Promise<SettingsMutationResult<RestaurantSettings>> {
  const context = await requirePermission(restaurantId, "restaurant.manage");
  const result = await persistSettings(restaurantId, {
    notifications_email_enabled: input.notificationsEmailEnabled,
    notifications_whatsapp_enabled: input.notificationsWhatsappEnabled,
    notifications_sms_enabled: input.notificationsSmsEnabled,
    notifications_in_app_enabled: input.notificationsInAppEnabled,
    notify_customer_on_join: input.notifyCustomerOnJoin,
    notify_customer_on_called: input.notifyCustomerOnCalled,
    notify_customer_on_reminder: input.notifyCustomerOnReminder,
    notify_staff_on_join: input.notifyStaffOnJoin,
    notify_staff_on_cancel: input.notifyStaffOnCancel,
    notify_staff_on_no_show: input.notifyStaffOnNoShow,
    notify_staff_queue_busy_threshold: input.notifyStaffQueueBusyThreshold,
  });

  if (!result.ok) {
    return result;
  }

  await writeAuditLog({
    restaurantId,
    userId: context.user.id,
    action: "restaurant.notification_settings_updated",
    entityType: "restaurant_settings",
    entityId: restaurantId,
    metadata: {
      emailEnabled: input.notificationsEmailEnabled,
      whatsappEnabled: input.notificationsWhatsappEnabled,
      smsEnabled: input.notificationsSmsEnabled,
      inAppEnabled: input.notificationsInAppEnabled,
      notifyCustomerOnJoin: input.notifyCustomerOnJoin,
      notifyCustomerOnCalled: input.notifyCustomerOnCalled,
      notifyStaffOnJoin: input.notifyStaffOnJoin,
    },
  });

  return result;
}
