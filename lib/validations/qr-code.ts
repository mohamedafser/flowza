import { z } from "zod";

export const QR_CODE_TYPES = ["QUEUE_JOIN"] as const;
export type QRCodeType = (typeof QR_CODE_TYPES)[number];

export const QR_NAME_MIN = 1;
export const QR_NAME_MAX = 80;

export const qrCodeSettingsSchema = z.object({
  showRestaurantName: z.boolean().default(true),
  showBranchName: z.boolean().default(true),
  showQueueName: z.boolean().default(true),
  caption: z.string().trim().max(120).optional(),
});

export type QRCodeSettings = z.infer<typeof qrCodeSettingsSchema>;

export const qrCodeSettingsInputSchema = qrCodeSettingsSchema.partial();

export const createQRCodeSchema = z.object({
  restaurantId: z.string().uuid("Select a restaurant."),
  branchId: z.string().uuid("Select a branch."),
  queueId: z.string().uuid("Select a queue."),
  name: z
    .string()
    .trim()
    .min(QR_NAME_MIN, "QR name is required.")
    .max(QR_NAME_MAX, "QR name is too long."),
  isActive: z.boolean().default(true),
  settings: qrCodeSettingsInputSchema.optional(),
});

export type CreateQRCodeInput = z.infer<typeof createQRCodeSchema>;

export const updateQRCodeSchema = z.object({
  qrCodeId: z.string().uuid("Invalid QR code."),
  branchId: z.string().uuid("Select a branch.").optional(),
  queueId: z.string().uuid("Select a queue.").optional(),
  name: z
    .string()
    .trim()
    .min(QR_NAME_MIN, "QR name is required.")
    .max(QR_NAME_MAX, "QR name is too long.")
    .optional(),
  isActive: z.boolean().optional(),
  settings: qrCodeSettingsInputSchema.optional(),
});

export type UpdateQRCodeInput = z.infer<typeof updateQRCodeSchema>;

export const setQRCodeStatusSchema = z.object({
  qrCodeId: z.string().uuid("Invalid QR code."),
  isActive: z.boolean(),
});

export type SetQRCodeStatusInput = z.infer<typeof setQRCodeStatusSchema>;

export const qrCodeIdSchema = z.object({
  qrCodeId: z.string().uuid("Invalid QR code."),
});

export const publicQRTokenParamSchema = z.object({
  publicToken: z
    .string()
    .min(32, "This QR link is invalid.")
    .max(64, "This QR link is invalid.")
    .regex(/^[A-Za-z0-9_-]+$/, "This QR link is invalid."),
});

export function normalizeQRCodeSettings(input: unknown): QRCodeSettings {
  const parsed = qrCodeSettingsSchema.safeParse(input ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  return qrCodeSettingsSchema.parse({});
}
