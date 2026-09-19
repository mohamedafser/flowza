import { z } from "zod";
import {
  customerNameSchema,
  createCustomerSchema,
} from "@/lib/validations/customer";
import {
  MAX_PARTY_SIZE,
  MIN_PARTY_SIZE,
  partySizeSchema,
} from "@/lib/validations/queue";
import { isValidPhoneInput } from "@/lib/utils/phone";

export const RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const ACTIVE_RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "SEATED",
] as const satisfies readonly ReservationStatus[];

export const TERMINAL_RESERVATION_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly ReservationStatus[];

export const RESERVATION_VIEWS = ["today", "upcoming", "past"] as const;
export type ReservationView = (typeof RESERVATION_VIEWS)[number];

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 480;
export const DEFAULT_DURATION_MINUTES = 90;
export const RESERVATION_PAGE_SIZE = 50;

export const reservationStatusSchema = z.enum(RESERVATION_STATUSES, {
  errorMap: () => ({ message: "Select a valid reservation status" }),
});

export const reservationViewSchema = z.enum(RESERVATION_VIEWS, {
  errorMap: () => ({ message: "Select a valid view" }),
});

const uuidSchema = z.string().uuid("Invalid id");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date (YYYY-MM-DD)");

const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a valid time")
  .transform((value) => (value.length === 5 ? `${value}:00` : value));

const durationSchema = z.coerce
  .number({ invalid_type_error: "Duration must be a number" })
  .int("Duration must be a whole number")
  .min(MIN_DURATION_MINUTES, "Duration must be at least 15 minutes")
  .max(MAX_DURATION_MINUTES, "Duration is too long");

const optionalNotes = z.preprocess(
  (value) => (value == null ? undefined : value),
  z
    .string()
    .trim()
    .max(2000, "Notes are too long")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
);

const optionalSpecialRequests = z.preprocess(
  (value) => (value == null ? undefined : value),
  z
    .string()
    .trim()
    .max(2000, "Special requests are too long")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
);

const optionalCancelReason = z.preprocess(
  (value) => (value == null ? undefined : value),
  z
    .string()
    .trim()
    .max(500, "Reason is too long")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
);

const optionalUuid = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  uuidSchema.nullable(),
);

export const createReservationSchema = z.object({
  branchId: uuidSchema,
  customerId: uuidSchema,
  reservationDate: dateSchema,
  startTime: timeSchema,
  partySize: partySizeSchema,
  durationMinutes: durationSchema.default(DEFAULT_DURATION_MINUTES),
  tableId: optionalUuid.optional(),
  notes: optionalNotes,
  specialRequests: optionalSpecialRequests,
  confirm: z.boolean().optional().default(false),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const updateReservationSchema = z.object({
  reservationId: uuidSchema,
  reservationDate: dateSchema.optional(),
  startTime: timeSchema.optional(),
  partySize: partySizeSchema.optional(),
  durationMinutes: durationSchema.optional(),
  tableId: optionalUuid.optional(),
  notes: optionalNotes,
  specialRequests: optionalSpecialRequests,
  customerId: uuidSchema.optional(),
});

export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

export const reservationIdSchema = z.object({
  reservationId: uuidSchema,
});

export const cancelReservationSchema = z.object({
  reservationId: uuidSchema,
  reason: optionalCancelReason,
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

export const assignReservationTableSchema = z.object({
  reservationId: uuidSchema,
  tableId: uuidSchema,
});

export type AssignReservationTableInput = z.infer<
  typeof assignReservationTableSchema
>;

export const seatReservationSchema = z.object({
  reservationId: uuidSchema,
  tableId: uuidSchema.optional(),
});

export type SeatReservationInput = z.infer<typeof seatReservationSchema>;

export const convertReservationToQueueSchema = z.object({
  reservationId: uuidSchema,
  queueId: uuidSchema,
});

export type ConvertReservationToQueueInput = z.infer<
  typeof convertReservationToQueueSchema
>;

export const createWalkInSchema = z
  .object({
    branchId: uuidSchema,
    mode: z.enum(["queue", "seat"]),
    queueId: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      uuidSchema.optional(),
    ),
    tableId: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      uuidSchema.optional(),
    ),
    customerId: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      uuidSchema.optional(),
    ),
    name: customerNameSchema.optional(),
    phone: createCustomerSchema.shape.phone.optional(),
    email: createCustomerSchema.shape.email.optional(),
    partySize: partySizeSchema,
    notes: optionalNotes,
  })
  .superRefine((value, ctx) => {
    if (value.mode === "queue" && !value.queueId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Queue is required for walk-in queue entry.",
        path: ["queueId"],
      });
    }
    if (value.mode === "seat" && !value.tableId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Table is required to seat a walk-in.",
        path: ["tableId"],
      });
    }
    if (!value.customerId && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Customer name is required.",
        path: ["name"],
      });
    }
    if (!value.customerId && !value.phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required.",
        path: ["phone"],
      });
    }
  });

export type CreateWalkInInput = z.infer<typeof createWalkInSchema>;

export const reservationListQuerySchema = z.object({
  branchId: uuidSchema,
  view: reservationViewSchema.default("today"),
  date: dateSchema.optional(),
  status: reservationStatusSchema.optional(),
  search: z.preprocess(
    (value) => (value == null ? undefined : value),
    z.string().trim().max(120).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(RESERVATION_PAGE_SIZE),
});

export type ReservationListQuery = z.infer<typeof reservationListQuerySchema>;

export const availabilityQuerySchema = z.object({
  branchId: uuidSchema,
  reservationDate: dateSchema,
  startTime: timeSchema,
  partySize: partySizeSchema,
  durationMinutes: durationSchema.default(DEFAULT_DURATION_MINUTES),
  tableId: optionalUuid.optional(),
  excludeReservationId: uuidSchema.optional(),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/** Prefer a human-readable first Zod issue for action responses. */
export function firstZodMessage(
  error: z.ZodError,
  fallback = "Invalid request.",
): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const path = issue.path.filter(Boolean).join(".");
  if (path && issue.message) {
    return `${path}: ${issue.message}`;
  }
  return issue.message || fallback;
}

export const reservationFormSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  reservationDate: dateSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time"),
  partySize: z.coerce.number().int().min(MIN_PARTY_SIZE).max(MAX_PARTY_SIZE),
  durationMinutes: durationSchema,
  tableId: z.string().uuid().nullable().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
  specialRequests: z.string().max(2000).optional(),
  confirm: z.boolean().optional(),
});

export type ReservationFormValues = z.infer<typeof reservationFormSchema>;

export const walkInFormSchema = z
  .object({
    mode: z.enum(["queue", "seat"]),
    queueId: z.string().uuid().optional().or(z.literal("")),
    tableId: z.string().uuid().optional().or(z.literal("")),
    customerId: z.string().uuid().optional().or(z.literal("")),
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().max(254).optional(),
    partySize: partySizeSchema,
    notes: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.customerId && z.string().uuid().safeParse(value.customerId).success) {
      return;
    }
    if (!value.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name is required.",
        path: ["name"],
      });
    }
    if (!value.phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required.",
        path: ["phone"],
      });
    } else if (!isValidPhoneInput(value.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid phone number.",
        path: ["phone"],
      });
    }
  });

export type WalkInFormValues = z.infer<typeof walkInFormSchema>;
