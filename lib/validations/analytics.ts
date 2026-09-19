import { z } from "zod";
import { DASHBOARD_DATE_PRESETS } from "@/lib/analytics/date-range";

const uuidSchema = z.string().uuid();

export const analyticsDatePresetSchema = z.enum(DASHBOARD_DATE_PRESETS);

const analyticsQueryObjectSchema = z.object({
  branchId: uuidSchema,
  preset: analyticsDatePresetSchema.default("today"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  compareBranchIds: z.array(uuidSchema).max(8).optional(),
});

function refineAnalyticsQuery(
  value: z.infer<typeof analyticsQueryObjectSchema>,
  ctx: z.RefinementCtx,
) {
  if (value.preset === "custom") {
    if (!value.startDate || !value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom ranges require startDate and endDate.",
        path: ["startDate"],
      });
    }
  }
}

export const analyticsQuerySchema =
  analyticsQueryObjectSchema.superRefine(refineAnalyticsQuery);

export const analyticsExportSchema = analyticsQueryObjectSchema
  .extend({
    kind: z.enum([
      "queue_summary",
      "reservation_summary",
      "customer_summary",
    ]),
  })
  .superRefine(refineAnalyticsQuery);

export type AnalyticsQueryInput = z.infer<typeof analyticsQueryObjectSchema>;
export type AnalyticsExportInput = z.infer<typeof analyticsExportSchema>;

export function firstZodMessage(
  error: z.ZodError,
  fallback = "Invalid request.",
): string {
  return error.issues[0]?.message ?? fallback;
}
