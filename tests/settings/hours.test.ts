import { describe, expect, it } from "vitest";
import {
  copyMondayToOtherDays,
  defaultWeekSchedule,
  emptyWeekSchedule,
  formatDayHours,
  isOpenAt,
  periodsOverlap,
  resolveHoursForDate,
  validatePeriods,
  validateWeekSchedule,
  type WeekSchedule,
} from "@/lib/utils/hours";
import {
  createSpecialHoursSchema,
  dayScheduleSchema,
  operatingPeriodSchema,
  weekScheduleSchema,
} from "@/lib/validations/hours";

function openDay(
  dayOfWeek: number,
  periods: Array<{ openTime: string; closeTime: string }>,
) {
  return { dayOfWeek, isClosed: false, periods };
}

describe("operating period validation", () => {
  it("accepts an open day with a valid window", () => {
    const parsed = operatingPeriodSchema.safeParse({
      openTime: "11:00",
      closeTime: "23:00",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a start time that is not before the end time", () => {
    expect(
      operatingPeriodSchema.safeParse({
        openTime: "15:00",
        closeTime: "11:00",
      }).success,
    ).toBe(false);
    expect(
      operatingPeriodSchema.safeParse({
        openTime: "11:00",
        closeTime: "11:00",
      }).success,
    ).toBe(false);
  });

  it("detects overlapping periods", () => {
    expect(
      periodsOverlap(
        { openTime: "11:00", closeTime: "15:00" },
        { openTime: "14:00", closeTime: "18:00" },
      ),
    ).toBe(true);
    expect(
      periodsOverlap(
        { openTime: "11:00", closeTime: "15:00" },
        { openTime: "15:00", closeTime: "18:00" },
      ),
    ).toBe(false);
  });

  it("rejects overlapping and duplicate periods on an open day", () => {
    const overlap = dayScheduleSchema.safeParse(
      openDay(1, [
        { openTime: "11:00", closeTime: "15:00" },
        { openTime: "14:00", closeTime: "18:00" },
      ]),
    );
    expect(overlap.success).toBe(false);

    const duplicate = dayScheduleSchema.safeParse(
      openDay(1, [
        { openTime: "11:00", closeTime: "15:00" },
        { openTime: "11:00", closeTime: "15:00" },
      ]),
    );
    expect(duplicate.success).toBe(false);
  });

  it("allows multiple non-overlapping lunch and dinner periods", () => {
    const parsed = dayScheduleSchema.safeParse(
      openDay(1, [
        { openTime: "11:00", closeTime: "15:00" },
        { openTime: "18:00", closeTime: "23:00" },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects closed days that still contain periods", () => {
    const parsed = dayScheduleSchema.safeParse({
      dayOfWeek: 7,
      isClosed: true,
      periods: [{ openTime: "11:00", closeTime: "15:00" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects open days without periods", () => {
    const parsed = dayScheduleSchema.safeParse({
      dayOfWeek: 1,
      isClosed: false,
      periods: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("week schedule", () => {
  it("accepts a full default week", () => {
    const parsed = weekScheduleSchema.safeParse({
      days: defaultWeekSchedule(),
    });
    expect(parsed.success).toBe(true);
    expect(validateWeekSchedule(defaultWeekSchedule())).toBeNull();
  });

  it("copies Monday onto the rest of the week", () => {
    const week = emptyWeekSchedule();
    week[0] = openDay(1, [
      { openTime: "10:00", closeTime: "14:00" },
      { openTime: "18:00", closeTime: "22:00" },
    ]) as WeekSchedule[number];
    const copied = copyMondayToOtherDays(week);
    expect(copied[6]?.periods[0]?.openTime).toBe("10:00");
    expect(copied[6]?.isClosed).toBe(false);
  });
});

describe("hours resolution", () => {
  const restaurantWeek: WeekSchedule = defaultWeekSchedule();
  const branchWeek: WeekSchedule = emptyWeekSchedule().map((day) =>
    day.dayOfWeek === 1
      ? {
          dayOfWeek: 1 as const,
          isClosed: false,
          periods: [{ openTime: "10:00", closeTime: "22:00" }],
        }
      : day,
  );

  it("uses restaurant hours when the branch has no override", () => {
    const resolved = resolveHoursForDate({
      date: "2026-09-21",
      restaurantWeek,
    });
    expect(resolved.source).toBe("restaurant");
    expect(resolved.usingRestaurantHours).toBe(true);
    expect(resolved.isClosed).toBe(false);
    expect(isOpenAt(resolved, "12:00")).toBe(true);
  });

  it("uses branch hours when a custom schedule exists", () => {
    const resolved = resolveHoursForDate({
      date: "2026-09-21",
      branchWeek,
      restaurantWeek,
    });
    expect(resolved.source).toBe("branch");
    expect(resolved.usingRestaurantHours).toBe(false);
    expect(isOpenAt(resolved, "10:30")).toBe(true);
    expect(isOpenAt(resolved, "09:00")).toBe(false);
  });

  it("treats a closed restaurant day as closed", () => {
    const closedSunday = emptyWeekSchedule();
    const resolved = resolveHoursForDate({
      date: "2026-09-20",
      restaurantWeek: closedSunday,
    });
    expect(resolved.isClosed).toBe(true);
    expect(isOpenAt(resolved, "12:00")).toBe(false);
  });

  it("applies a restaurant special-hours override", () => {
    const resolved = resolveHoursForDate({
      date: "2026-12-25",
      restaurantSpecialHours: [
        {
          date: "2026-12-25",
          isClosed: true,
          openTime: null,
          closeTime: null,
          reason: "Christmas",
          branchId: null,
        },
      ],
      restaurantWeek,
    });
    expect(resolved.source).toBe("special-restaurant");
    expect(resolved.isClosed).toBe(true);
    expect(resolved.reason).toBe("Christmas");
  });

  it("prefers branch special hours over restaurant special hours", () => {
    const resolved = resolveHoursForDate({
      date: "2026-12-31",
      branchSpecialHours: [
        {
          date: "2026-12-31",
          isClosed: false,
          openTime: "12:00",
          closeTime: "20:00",
          reason: "New Year's Eve",
          branchId: "branch-a",
        },
      ],
      restaurantSpecialHours: [
        {
          date: "2026-12-31",
          isClosed: true,
          openTime: null,
          closeTime: null,
          reason: "Closed",
          branchId: null,
        },
      ],
      restaurantWeek,
    });
    expect(resolved.source).toBe("special-branch");
    expect(resolved.isClosed).toBe(false);
    expect(isOpenAt(resolved, "15:00")).toBe(true);
    expect(isOpenAt(resolved, "21:00")).toBe(false);
  });
});

describe("hours formatting", () => {
  it("formats multiple periods and closed days", () => {
    expect(
      formatDayHours(
        {
          isClosed: false,
          periods: [
            { openTime: "11:00", closeTime: "15:00" },
            { openTime: "18:00", closeTime: "23:00" },
          ],
        },
        "12h",
      ),
    ).toMatch(/11:00/);
    expect(formatDayHours({ isClosed: true, periods: [] }, "12h")).toBe(
      "Closed",
    );
  });
});

describe("special hours validation", () => {
  it("accepts a closed holiday", () => {
    const parsed = createSpecialHoursSchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      date: "2026-12-25",
      isClosed: true,
      reason: "Christmas",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires times when the date is open", () => {
    const parsed = createSpecialHoursSchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      date: "2026-12-31",
      isClosed: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid date", () => {
    const parsed = createSpecialHoursSchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      date: "2026-13-40",
      isClosed: true,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("period helper validation", () => {
  it("reports ordered overlap issues", () => {
    const issues = validatePeriods(
      [
        { openTime: "11:00", closeTime: "16:00" },
        { openTime: "15:30", closeTime: "20:00" },
      ],
      false,
    );
    expect(issues.some((issue) => /overlap/i.test(issue.message))).toBe(true);
  });
});
