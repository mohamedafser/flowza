import { describe, expect, it } from "vitest";
import {
  availabilityMessage,
  evaluateAvailability,
  findConflictingReservations,
  suggestTablesForParty,
  timesOverlap,
} from "@/lib/reservations/availability";
import { emptyWeekSchedule, type ResolvedHours } from "@/lib/utils/hours";

const openHours: ResolvedHours = {
  source: "restaurant",
  isClosed: false,
  periods: [{ openTime: "11:00", closeTime: "23:00" }],
  reason: null,
  usingRestaurantHours: true,
};

const closedHours: ResolvedHours = {
  source: "special-branch",
  isClosed: true,
  periods: [],
  reason: "Holiday",
  usingRestaurantHours: false,
};

describe("reservation availability", () => {
  it("detects overlapping time windows", () => {
    expect(timesOverlap("18:00", "19:30", "19:00", "20:00")).toBe(true);
    expect(timesOverlap("18:00", "19:00", "19:00", "20:00")).toBe(false);
    expect(timesOverlap("12:00", "13:00", "14:00", "15:00")).toBe(false);
  });

  it("finds table conflicts for active reservations", () => {
    const conflicts = findConflictingReservations(
      [
        {
          id: "r1",
          startTime: "19:00",
          endTime: "20:30",
          durationMinutes: 90,
          partySize: 2,
          tableId: "t1",
          status: "CONFIRMED",
        },
        {
          id: "r2",
          startTime: "19:00",
          endTime: "20:30",
          durationMinutes: 90,
          partySize: 2,
          tableId: "t2",
          status: "CANCELLED",
        },
      ],
      {
        reservationDate: "2026-09-20",
        startTime: "19:30",
        endTime: "21:00",
        partySize: 2,
        tableId: "t1",
      },
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.id).toBe("r1");
  });

  it("rejects closed days and outside hours", () => {
    const closed = evaluateAvailability({
      resolvedHours: closedHours,
      timezone: "UTC",
      branchId: "b1",
      slot: {
        reservationDate: "2026-12-25",
        startTime: "19:00",
        endTime: "20:30",
        partySize: 2,
      },
      existing: [],
      tables: [],
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(closed.ok).toBe(false);
    expect(closed.issues).toContain("CLOSED");

    const outside = evaluateAvailability({
      resolvedHours: openHours,
      timezone: "UTC",
      branchId: "b1",
      slot: {
        reservationDate: "2026-09-20",
        startTime: "09:00",
        endTime: "10:30",
        partySize: 2,
      },
      existing: [],
      tables: [],
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(outside.ok).toBe(false);
    expect(outside.issues).toContain("OUTSIDE_HOURS");
    expect(availabilityMessage(outside.issues)).toMatch(/operating hours/i);
  });

  it("rejects past slots and capacity mismatches", () => {
    const past = evaluateAvailability({
      resolvedHours: openHours,
      timezone: "UTC",
      branchId: "b1",
      slot: {
        reservationDate: "2020-01-01",
        startTime: "19:00",
        endTime: "20:30",
        partySize: 2,
      },
      existing: [],
      tables: [],
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(past.issues).toContain("IN_PAST");

    const capacity = evaluateAvailability({
      resolvedHours: openHours,
      timezone: "UTC",
      branchId: "b1",
      slot: {
        reservationDate: "2026-09-20",
        startTime: "19:00",
        endTime: "20:30",
        partySize: 6,
        tableId: "t1",
      },
      existing: [],
      tables: [
        {
          id: "t1",
          capacity: 2,
          status: "AVAILABLE",
          branchId: "b1",
        },
      ],
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(capacity.issues).toContain("TABLE_CAPACITY");
  });

  it("suggests available tables by best fit", () => {
    const suggested = suggestTablesForParty(
      [
        { id: "t1", capacity: 8, status: "AVAILABLE", branchId: "b1" },
        { id: "t2", capacity: 4, status: "AVAILABLE", branchId: "b1" },
        { id: "t3", capacity: 4, status: "BLOCKED", branchId: "b1" },
        { id: "t4", capacity: 2, status: "AVAILABLE", branchId: "b1" },
        { id: "t5", capacity: 4, status: "AVAILABLE", branchId: "other" },
      ],
      4,
      "b1",
      new Set(),
    );
    expect(suggested[0]).toBe("t2");
    expect(suggested).not.toContain("t3");
    expect(suggested).not.toContain("t4");
    expect(suggested).not.toContain("t5");
    expect(emptyWeekSchedule()).toHaveLength(7);
  });
});
