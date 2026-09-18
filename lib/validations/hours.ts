import { z } from "zod";
import { isValidDateString, normalizeTime } from "@/lib/utils/datetime";
import { periodsAreDuplicate, periodsOverlap } from "@/lib/utils/hours";

export const timeOfDaySchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeTime(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid time",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const operatingPeriodSchema = z
  .object({
    openTime: timeOfDaySchema,
    closeTime: timeOfDaySchema,
  })
  .superRefine((period, ctx) => {
    if (period.openTime >= period.closeTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start time must be before end time",
        path: ["closeTime"],
      });
    }
  });

export type OperatingPeriodInput = z.infer<typeof operatingPeriodSchema>;

export const dayScheduleSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    isClosed: z.boolean(),
    periods: z.array(operatingPeriodSchema).max(8, "Too many periods"),
  })
  .superRefine((day, ctx) => {
    if (day.isClosed && day.periods.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Closed days cannot contain active periods",
        path: ["periods"],
      });
    }

    if (!day.isClosed && day.periods.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Open days need at least one period",
        path: ["periods"],
      });
    }

    const ordered = [...day.periods].sort((left, right) =>
      left.openTime.localeCompare(right.openTime),
    );

    for (let index = 0; index < ordered.length; index += 1) {
      const current = ordered[index]!;
      const next = ordered[index + 1];
      if (!next) continue;

      if (periodsAreDuplicate(current, next)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate periods are not allowed",
          path: ["periods"],
        });
        continue;
      }

      if (periodsOverlap(current, next)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Periods cannot overlap",
          path: ["periods"],
        });
      }
    }
  });

export const weekScheduleSchema = z
  .object({
    days: z.array(dayScheduleSchema).length(7, "Schedule must include 7 days"),
  })
  .superRefine((week, ctx) => {
    const seen = new Set(week.days.map((day) => day.dayOfWeek));
    if (seen.size !== 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each weekday must appear exactly once",
        path: ["days"],
      });
    }
  });

export type WeekScheduleValues = z.infer<typeof weekScheduleSchema>;

export const updateOperatingHoursSchema = z
  .object({
    restaurantId: z.string().uuid("Invalid restaurant"),
    branchId: z.string().uuid("Invalid branch").nullable().optional(),
    days: z.array(dayScheduleSchema).length(7, "Schedule must include 7 days"),
  })
  .superRefine((value, ctx) => {
    const seen = new Set(value.days.map((day) => day.dayOfWeek));
    if (seen.size !== 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each weekday must appear exactly once",
        path: ["days"],
      });
    }
  });

export type UpdateOperatingHoursInput = z.infer<
  typeof updateOperatingHoursSchema
>;

export const clearBranchHoursSchema = z.object({
  restaurantId: z.string().uuid("Invalid restaurant"),
  branchId: z.string().uuid("Invalid branch"),
});

export type ClearBranchHoursInput = z.infer<typeof clearBranchHoursSchema>;

const optionalReasonSchema = z
  .string()
  .trim()
  .max(200, "Reason is too long")
  .nullable()
  .optional()
  .transform((value) => {
    if (!value) return null;
    return value;
  });

const specialHoursBaseSchema = z.object({
  date: z.string().trim().refine(isValidDateString, "Enter a valid date"),
  isClosed: z.boolean(),
  openTime: z.string().trim().nullable().optional(),
  closeTime: z.string().trim().nullable().optional(),
  reason: optionalReasonSchema,
});

function refineSpecialHours(
  value: z.infer<typeof specialHoursBaseSchema>,
  ctx: z.RefinementCtx,
) {
  if (value.isClosed) {
    if (value.openTime || value.closeTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Closed dates cannot include opening hours",
        path: ["openTime"],
      });
    }
    return;
  }

  const open = normalizeTime(value.openTime ?? "");
  const close = normalizeTime(value.closeTime ?? "");
  if (!open) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Opening time is required",
      path: ["openTime"],
    });
  }
  if (!close) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Closing time is required",
      path: ["closeTime"],
    });
  }
  if (open && close && open >= close) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start time must be before end time",
      path: ["closeTime"],
    });
  }
}

function transformSpecialHours(value: z.infer<typeof specialHoursBaseSchema>) {
  if (value.isClosed) {
    return {
      date: value.date,
      isClosed: true as const,
      openTime: null,
      closeTime: null,
      reason: value.reason ?? null,
    };
  }

  return {
    date: value.date,
    isClosed: false as const,
    openTime: normalizeTime(value.openTime ?? ""),
    closeTime: normalizeTime(value.closeTime ?? ""),
    reason: value.reason ?? null,
  };
}

export const specialHoursFieldsSchema = specialHoursBaseSchema
  .superRefine(refineSpecialHours)
  .transform(transformSpecialHours);

export type SpecialHoursFields = z.infer<typeof specialHoursFieldsSchema>;

export const createSpecialHoursSchema = z
  .object({
    restaurantId: z.string().uuid("Invalid restaurant"),
    branchId: z.string().uuid("Invalid branch").nullable().optional(),
    date: z.string().trim().refine(isValidDateString, "Enter a valid date"),
    isClosed: z.boolean(),
    openTime: z.string().trim().nullable().optional(),
    closeTime: z.string().trim().nullable().optional(),
    reason: optionalReasonSchema,
  })
  .superRefine(refineSpecialHours)
  .transform((value) => ({
    restaurantId: value.restaurantId,
    branchId: value.branchId ?? null,
    ...transformSpecialHours(value),
  }));

export type CreateSpecialHoursInput = z.infer<typeof createSpecialHoursSchema>;

export const updateSpecialHoursSchema = z
  .object({
    specialHoursId: z.string().uuid("Invalid special hours"),
    restaurantId: z.string().uuid("Invalid restaurant"),
    date: z.string().trim().refine(isValidDateString, "Enter a valid date"),
    isClosed: z.boolean(),
    openTime: z.string().trim().nullable().optional(),
    closeTime: z.string().trim().nullable().optional(),
    reason: optionalReasonSchema,
  })
  .superRefine(refineSpecialHours)
  .transform((value) => ({
    specialHoursId: value.specialHoursId,
    restaurantId: value.restaurantId,
    ...transformSpecialHours(value),
  }));

export type UpdateSpecialHoursInput = z.infer<typeof updateSpecialHoursSchema>;

export const deleteSpecialHoursSchema = z.object({
  specialHoursId: z.string().uuid("Invalid special hours"),
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type DeleteSpecialHoursInput = z.infer<typeof deleteSpecialHoursSchema>;
