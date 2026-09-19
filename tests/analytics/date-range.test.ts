import { describe, expect, it } from "vitest";
import {
  getDashboardDateRange,
  listDatesInRange,
  zonedDateTimeToUtc,
  formatHourRangeLabel,
} from "@/lib/analytics/date-range";

describe("dashboard date ranges", () => {
  const now = new Date("2026-09-19T10:30:00.000Z");

  it("resolves today in the branch timezone", () => {
    const range = getDashboardDateRange({
      branchTimezone: "Asia/Kolkata",
      preset: "today",
      now,
    });

    expect(range.startDate).toBe("2026-09-19");
    expect(range.endDate).toBe("2026-09-19");
    expect(range.grouping).toBe("hour");
    expect(range.dayCount).toBe(1);
    expect(range.label).toBe("Today");
  });

  it("resolves yesterday relative to branch timezone", () => {
    // 2026-09-18 19:00 UTC = 2026-09-19 00:30 IST → "today" is the 19th
    const eveningUtc = new Date("2026-09-18T19:00:00.000Z");
    const range = getDashboardDateRange({
      branchTimezone: "Asia/Kolkata",
      preset: "yesterday",
      now: eveningUtc,
    });

    expect(range.startDate).toBe("2026-09-18");
    expect(range.endDate).toBe("2026-09-18");

    // Same UTC instant is still the 18th in UTC, so yesterday is the 17th
    const utcRange = getDashboardDateRange({
      branchTimezone: "UTC",
      preset: "yesterday",
      now: eveningUtc,
    });
    expect(utcRange.startDate).toBe("2026-09-17");
  });

  it("resolves last 7 and 30 days inclusively", () => {
    const week = getDashboardDateRange({
      branchTimezone: "UTC",
      preset: "last_7_days",
      now,
    });
    const month = getDashboardDateRange({
      branchTimezone: "UTC",
      preset: "last_30_days",
      now,
    });

    expect(week.startDate).toBe("2026-09-13");
    expect(week.endDate).toBe("2026-09-19");
    expect(week.grouping).toBe("day");
    expect(month.startDate).toBe("2026-08-21");
    expect(month.dayCount).toBe(30);
  });

  it("supports custom ranges with branch-local UTC bounds", () => {
    const range = getDashboardDateRange({
      branchTimezone: "America/New_York",
      preset: "custom",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      now,
    });

    expect(range.startDate).toBe("2026-09-01");
    expect(range.endDate).toBe("2026-09-03");
    expect(range.dayCount).toBe(3);
    expect(listDatesInRange(range.startDate, range.endDate)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);

    const start = zonedDateTimeToUtc("2026-09-01", "00:00:00", "America/New_York");
    expect(range.startAt).toBe(start.toISOString());
  });

  it("rejects inverted or oversized custom ranges", () => {
    expect(() =>
      getDashboardDateRange({
        branchTimezone: "UTC",
        preset: "custom",
        startDate: "2026-09-10",
        endDate: "2026-09-01",
      }),
    ).toThrow(/on or before/);

    expect(() =>
      getDashboardDateRange({
        branchTimezone: "UTC",
        preset: "custom",
        startDate: "2026-01-01",
        endDate: "2026-06-01",
      }),
    ).toThrow(/90 days/);
  });

  it("formats peak hour labels", () => {
    expect(formatHourRangeLabel(12)).toBe("12 PM → 1 PM");
    expect(formatHourRangeLabel(19)).toBe("7 PM → 8 PM");
  });
});
