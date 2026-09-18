import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  getCurrencyCode,
  getCurrencySymbol,
  isCurrencyCode,
} from "@/lib/utils/currency";
import {
  formatDate,
  formatTimeOfDay,
  getZonedDateParts,
} from "@/lib/utils/datetime";
import { resolveBranchTimezone } from "@/lib/utils/timezone";

describe("currency utilities", () => {
  it("formats INR with a rupee symbol", () => {
    const formatted = formatCurrency(1250, "INR");
    expect(formatted).toContain("1,250");
    expect(getCurrencySymbol("INR")).toBe("₹");
  });

  it("normalizes codes and rejects unknown values", () => {
    expect(getCurrencyCode("usd")).toBe("USD");
    expect(isCurrencyCode("INR")).toBe(true);
    expect(isCurrencyCode("XXX")).toBe(false);
  });
});

describe("date and time utilities", () => {
  it("formats dates without storing a formatted database value", () => {
    const instant = new Date("2026-09-18T12:00:00.000Z");
    expect(formatDate(instant, "DD/MM/YYYY", "UTC")).toBe("18/09/2026");
    expect(formatDate(instant, "MM/DD/YYYY", "UTC")).toBe("09/18/2026");
    expect(formatDate(instant, "YYYY-MM-DD", "UTC")).toBe("2026-09-18");
  });

  it("formats 12-hour and 24-hour times of day", () => {
    expect(formatTimeOfDay("11:00", "12h")).toMatch(/11:00/);
    expect(formatTimeOfDay("23:00", "24h")).toMatch(/23:00/);
  });

  it("resolves calendar parts in a branch timezone", () => {
    const instant = new Date("2026-09-18T18:30:00.000Z");
    const kolkata = getZonedDateParts(instant, "Asia/Kolkata");
    expect(kolkata.date).toBe("2026-09-19");
    expect(kolkata.hour).toBe(0);
    expect(kolkata.minute).toBe(0);
  });
});

describe("branch timezone resolution", () => {
  it("uses the restaurant timezone until a branch override is set", () => {
    expect(
      resolveBranchTimezone({
        restaurantTimezone: "Asia/Kolkata",
        branchTimezone: "UTC",
        useRestaurantTimezone: true,
      }),
    ).toBe("Asia/Kolkata");
    expect(
      resolveBranchTimezone({
        restaurantTimezone: "Asia/Kolkata",
        branchTimezone: "Asia/Dubai",
        useRestaurantTimezone: false,
      }),
    ).toBe("Asia/Dubai");
  });
});
