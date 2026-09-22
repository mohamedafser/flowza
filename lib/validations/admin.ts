import { z } from "zod";

export const ADMIN_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_ADMIN_PAGE_SIZE = 20;

export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value) =>
        (ADMIN_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
      "Invalid page size",
    )
    .default(DEFAULT_ADMIN_PAGE_SIZE),
});

export const adminRestaurantListSchema = adminPaginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z
    .enum(["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"])
    .default("ALL"),
  plan: z.string().trim().max(64).optional(),
  subscriptionStatus: z
    .enum([
      "ALL",
      "TRIALING",
      "ACTIVE",
      "PAST_DUE",
      "PAUSED",
      "CANCELLED",
      "EXPIRED",
      "NONE",
    ])
    .default("ALL"),
  createdFrom: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  createdTo: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});

export const adminRestaurantStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});

export const adminUserListSchema = adminPaginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  accountStatus: z.enum(["ALL", "ACTIVE", "DISABLED"]).default("ALL"),
  verification: z.enum(["ALL", "VERIFIED", "UNVERIFIED"]).default("ALL"),
  role: z.enum(["ALL", "OWNER", "ADMIN", "MANAGER", "STAFF"]).default("ALL"),
  restaurantId: z.string().uuid().optional(),
});

export const adminUserStatusSchema = z.object({
  accountStatus: z.enum(["ACTIVE", "DISABLED"]),
});

export const adminSubscriptionListSchema = adminPaginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  plan: z.string().trim().max(64).optional(),
  status: z
    .enum([
      "ALL",
      "TRIALING",
      "ACTIVE",
      "PAST_DUE",
      "PAUSED",
      "CANCELLED",
      "EXPIRED",
    ])
    .default("ALL"),
  billingCycle: z.enum(["ALL", "MONTHLY", "YEARLY"]).default("ALL"),
  createdFrom: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  createdTo: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});

export const adminChangePlanSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
});

export const adminExtendTrialSchema = z.object({
  days: z.coerce.number().int().min(1).max(365),
});

export const adminPlanLimitsSchema = z.object({
  max_branches: z.number().int().min(0).max(10_000),
  max_staff: z.number().int().min(0).max(100_000),
  max_tables: z.number().int().min(0).max(100_000),
  max_queue_entries_per_month: z.number().int().min(0).max(10_000_000),
  max_reservations_per_month: z.number().int().min(0).max(10_000_000).optional(),
  max_displays: z.number().int().min(0).max(10_000).optional(),
});

export const adminPlanUpsertSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Code must be UPPER_SNAKE_CASE"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  monthlyPrice: z.number().min(0).max(1_000_000),
  yearlyPrice: z.number().min(0).max(10_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase()),
  features: z.record(z.boolean()).default({}),
  limits: adminPlanLimitsSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const adminPaymentListSchema = adminPaginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z
    .enum(["ALL", "PENDING", "SUCCESS", "FAILED", "REFUNDED"])
    .default("ALL"),
  restaurantId: z.string().uuid().optional(),
  provider: z.string().trim().max(64).optional(),
  from: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  to: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});

export const adminRevenueRangeSchema = z.object({
  range: z
    .enum([
      "today",
      "yesterday",
      "last_7_days",
      "last_30_days",
      "this_month",
      "last_month",
      "custom",
    ])
    .default("last_30_days"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const adminAuditListSchema = adminPaginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  actorId: z.string().uuid().optional(),
  restaurantId: z.string().uuid().optional(),
  action: z.string().trim().max(120).optional(),
  from: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
  to: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});

export const adminSettingsUpdateSchema = z.object({
  platform_name: z.string().trim().min(1).max(80).optional(),
  support_email: z.string().trim().email().max(200).optional(),
  default_trial_days: z.number().int().min(0).max(365).optional(),
  default_currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .optional(),
  default_timezone: z.string().trim().min(1).max(80).optional(),
  maintenance_mode: z.boolean().optional(),
  maintenance_message: z.string().trim().min(1).max(500).optional(),
});

export function parseQueryObject(
  input: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = typeof value === "string" ? value : undefined;
  }
  return result;
}
