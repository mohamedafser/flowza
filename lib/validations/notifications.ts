import { z } from "zod";

export const notificationSettingsSchema = z.object({
  notificationsEmailEnabled: z.boolean(),
  notificationsWhatsappEnabled: z.boolean(),
  notificationsSmsEnabled: z.boolean(),
  notificationsInAppEnabled: z.boolean(),
  notifyCustomerOnJoin: z.boolean(),
  notifyCustomerOnCalled: z.boolean(),
  notifyCustomerOnReminder: z.boolean(),
  notifyStaffOnJoin: z.boolean(),
  notifyStaffOnCancel: z.boolean(),
  notifyStaffOnNoShow: z.boolean(),
  notifyStaffQueueBusyThreshold: z
    .union([z.null(), z.coerce.number().int()])
    .refine(
      (value) => value === null || value >= 1,
      "Busy threshold must be empty or at least 1",
    ),
});

export type NotificationSettingsValues = z.infer<
  typeof notificationSettingsSchema
>;

export const notificationSettingsUpdateSchema = notificationSettingsSchema.extend({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type NotificationSettingsUpdateInput = z.infer<
  typeof notificationSettingsUpdateSchema
>;
