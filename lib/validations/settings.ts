import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/utils/datetime";
import { DATE_FORMATS, TIME_FORMATS } from "@/lib/utils/datetime";
import { restaurantFormSchema } from "@/lib/validations/restaurant";

export const dateFormatSchema = z.enum(DATE_FORMATS, {
  errorMap: () => ({ message: "Select a valid date format" }),
});

export const timeFormatSchema = z.enum(TIME_FORMATS, {
  errorMap: () => ({ message: "Select a valid time format" }),
});

export const languageSchema = z.enum(LANGUAGE_CODES, {
  errorMap: () => ({ message: "Select a valid language" }),
});

export const localeSettingsSchema = z.object({
  defaultLanguage: languageSchema,
  dateFormat: dateFormatSchema,
  timeFormat: timeFormatSchema,
});

export type LocaleSettingsValues = z.infer<typeof localeSettingsSchema>;

export const generalSettingsSchema =
  restaurantFormSchema.merge(localeSettingsSchema);

export type GeneralSettingsValues = z.infer<typeof generalSettingsSchema>;

export const generalSettingsUpdateSchema = generalSettingsSchema.extend({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type GeneralSettingsUpdateInput = z.infer<
  typeof generalSettingsUpdateSchema
>;

const optionalCapacitySchema = z
  .union([z.null(), z.coerce.number().int("Capacity must be a whole number")])
  .refine(
    (value) => value === null || value >= 1,
    "Capacity must be unlimited or at least 1",
  );

export const tokenPrefixSchema = z
  .string()
  .trim()
  .min(1, "Token prefix is required")
  .max(8, "Token prefix must be at most 8 characters")
  .regex(/^[A-Za-z0-9]+$/, "Token prefix may only contain letters and numbers")
  .transform((value) => value.toUpperCase());

export const queueSettingsSchema = z.object({
  queueEnabled: z.boolean(),
  defaultQueueName: z
    .string()
    .trim()
    .min(1, "Queue name is required")
    .max(80, "Queue name is too long"),
  tokenPrefix: tokenPrefixSchema,
  startingTokenNumber: z.coerce
    .number({ invalid_type_error: "Starting token must be a number" })
    .int("Starting token must be a whole number")
    .min(1, "Starting token must be at least 1")
    .max(999999, "Starting token is too large"),
  defaultServiceMinutes: z.coerce
    .number({ invalid_type_error: "Service duration must be a number" })
    .int("Service duration must be a whole number")
    .min(1, "Service duration must be at least 1 minute")
    .max(24 * 60, "Service duration cannot exceed 24 hours"),
  maxQueueCapacity: optionalCapacitySchema,
  allowWalkIns: z.boolean(),
  allowSelfCheckIn: z.boolean(),
  allowManualEntry: z.boolean(),
  showEstimatedWait: z.boolean(),
  showQueuePosition: z.boolean(),
});

export type QueueSettingsValues = z.infer<typeof queueSettingsSchema>;

export const queueSettingsUpdateSchema = queueSettingsSchema.extend({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type QueueSettingsUpdateInput = z.infer<
  typeof queueSettingsUpdateSchema
>;

export const customerExperienceSchema = z.object({
  showEstimatedWait: z.boolean(),
  showQueuePosition: z.boolean(),
  showPartySize: z.boolean(),
  allowCustomerCancel: z.boolean(),
  allowSelfCheckIn: z.boolean(),
  requireCustomerName: z.boolean(),
  requireCustomerPhone: z.boolean(),
});

export type CustomerExperienceValues = z.infer<typeof customerExperienceSchema>;

export const customerExperienceUpdateSchema = customerExperienceSchema.extend({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type CustomerExperienceUpdateInput = z.infer<
  typeof customerExperienceUpdateSchema
>;
