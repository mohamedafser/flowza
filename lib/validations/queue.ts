import { z } from "zod";
import { tokenPrefixSchema } from "@/lib/validations/settings";
import {
  createCustomerSchema,
  customerNameSchema,
} from "@/lib/validations/customer";

export const QUEUE_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  CLOSED: "Closed",
};

export const QUEUE_ENTRY_STATUSES = [
  "WAITING",
  "CALLED",
  "SEATED",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type QueueEntryStatus = (typeof QUEUE_ENTRY_STATUSES)[number];

export const QUEUE_ENTRY_STATUS_LABELS: Record<QueueEntryStatus, string> = {
  WAITING: "Waiting",
  CALLED: "Called",
  SEATED: "Seated",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const QUEUE_EVENT_TYPES = [
  "JOINED",
  "CALLED",
  "SKIPPED",
  "CANCELLED",
  "SEATED",
  "COMPLETED",
  "NO_SHOW",
] as const;
export type QueueEventType = (typeof QUEUE_EVENT_TYPES)[number];

export const QUEUE_HISTORY_STATUSES = [
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
  "NO_SHOW",
  "SEATED",
  "CALLED",
] as const;
export type QueueHistoryStatus = (typeof QUEUE_HISTORY_STATUSES)[number];

export const MIN_PARTY_SIZE = 1;
export const MAX_PARTY_SIZE = 50;
export const MIN_SERVICE_MINUTES = 1;
export const MAX_SERVICE_MINUTES = 24 * 60;
export const DEFAULT_TOKEN_PAD = 3;

export const queueStatusSchema = z.enum(QUEUE_STATUSES, {
  errorMap: () => ({ message: "Select a valid queue status" }),
});

export const queueEntryStatusSchema = z.enum(QUEUE_ENTRY_STATUSES, {
  errorMap: () => ({ message: "Select a valid entry status" }),
});

export const partySizeSchema = z.coerce
  .number({ invalid_type_error: "Party size must be a number" })
  .int("Party size must be a whole number")
  .min(MIN_PARTY_SIZE, "Party size must be at least 1")
  .max(MAX_PARTY_SIZE, "Party size is too large");

export const serviceMinutesSchema = z.coerce
  .number({ invalid_type_error: "Service duration must be a number" })
  .int("Service duration must be a whole number")
  .min(MIN_SERVICE_MINUTES, "Service duration must be at least 1 minute")
  .max(MAX_SERVICE_MINUTES, "Service duration cannot exceed 24 hours");

export const startingNumberSchema = z.coerce
  .number({ invalid_type_error: "Starting number must be a number" })
  .int("Starting number must be a whole number")
  .min(1, "Starting number must be at least 1")
  .max(999999, "Starting number is too large");

export const queueNameSchema = z
  .string()
  .trim()
  .min(1, "Queue name is required")
  .max(80, "Queue name is too long");

export const queueFieldsSchema = z.object({
  name: queueNameSchema,
  prefix: tokenPrefixSchema,
  startingNumber: startingNumberSchema,
  estimatedServiceMinutes: serviceMinutesSchema,
  status: queueStatusSchema,
});

export type QueueFormValues = z.infer<typeof queueFieldsSchema>;

export const createQueueSchema = queueFieldsSchema.extend({
  branchId: z.string().uuid("Invalid branch"),
});

export type CreateQueueInput = z.infer<typeof createQueueSchema>;

export const updateQueueSchema = queueFieldsSchema.extend({
  queueId: z.string().uuid("Invalid queue"),
});

export type UpdateQueueInput = z.infer<typeof updateQueueSchema>;

export const updateQueueStatusSchema = z.object({
  queueId: z.string().uuid("Invalid queue"),
  status: queueStatusSchema,
});

export type UpdateQueueStatusInput = z.infer<typeof updateQueueStatusSchema>;

export const queueBundleQuerySchema = z.object({
  branchId: z.string().uuid("Invalid branch"),
  queueId: z.string().uuid("Invalid queue").optional().nullable(),
});

export type QueueBundleQuery = z.infer<typeof queueBundleQuerySchema>;

export const addCustomerToQueueSchema = z
  .object({
    queueId: z.string().uuid("Invalid queue"),
    partySize: partySizeSchema,
    customerId: z.string().uuid("Invalid customer").optional().nullable(),
    name: customerNameSchema.optional(),
    phone: z.preprocess(
      (value) => (value === null || value === undefined ? undefined : value),
      createCustomerSchema.shape.phone.optional(),
    ),
    email: z.preprocess(
      (value) => (value === null || value === undefined ? undefined : value),
      createCustomerSchema.shape.email.optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.customerId) {
      return;
    }
    if (!value.name || value.name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a customer or enter a name",
        path: ["name"],
      });
    }
    if (!value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required.",
        path: ["phone"],
      });
    }
  });

export type AddCustomerToQueueInput = z.infer<typeof addCustomerToQueueSchema>;

export const callNextQueueSchema = z.object({
  queueId: z.string().uuid("Invalid queue"),
});

export type CallNextQueueInput = z.infer<typeof callNextQueueSchema>;

export const queueEntryIdSchema = z.object({
  entryId: z.string().uuid("Invalid queue entry"),
});

export const callQueueEntrySchema = queueEntryIdSchema;
export type CallQueueEntryInput = z.infer<typeof callQueueEntrySchema>;

export const skipQueueEntrySchema = queueEntryIdSchema;
export type SkipQueueEntryInput = z.infer<typeof skipQueueEntrySchema>;

export const cancelQueueEntrySchema = queueEntryIdSchema;
export type CancelQueueEntryInput = z.infer<typeof cancelQueueEntrySchema>;

export const noShowQueueEntrySchema = queueEntryIdSchema;
export type NoShowQueueEntryInput = z.infer<typeof noShowQueueEntrySchema>;

export const completeQueueEntrySchema = queueEntryIdSchema;
export type CompleteQueueEntryInput = z.infer<typeof completeQueueEntrySchema>;

export const seatQueueEntrySchema = z.object({
  entryId: z.string().uuid("Invalid queue entry"),
  tableId: z.string().uuid("Select a table"),
});

export type SeatQueueEntryInput = z.infer<typeof seatQueueEntrySchema>;

export const searchQueueCustomersSchema = z.object({
  query: z.string().trim().max(120, "Search is too long"),
});

export type SearchQueueCustomersInput = z.infer<
  typeof searchQueueCustomersSchema
>;

export const addCustomerFormSchema = z
  .object({
    customerId: z.string().optional(),
    name: z.string(),
    phone: z.string(),
    email: z.string(),
    partySize: partySizeSchema,
  })
  .superRefine((value, ctx) => {
    if (value.customerId && z.string().uuid().safeParse(value.customerId).success) {
      return;
    }
    if (!value.name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name is required",
        path: ["name"],
      });
    }
    const phoneResult = createCustomerSchema.shape.phone.safeParse(value.phone);
    if (!phoneResult.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          phoneResult.error.issues[0]?.message ?? "Phone number is required.",
        path: ["phone"],
      });
    }
  });

export type AddCustomerFormValues = z.infer<typeof addCustomerFormSchema>;
