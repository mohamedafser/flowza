import { describe, expect, it } from "vitest";
import {
  businessDateForTimezone,
  formatQueueToken,
  nextQueueNumber,
  nextQueueToken,
  parseTokenNumber,
  tokenPadWidth,
} from "@/lib/queue/tokens";

describe("token formatting", () => {
  it("formats the first token with prefix and padding", () => {
    expect(formatQueueToken({ prefix: "A", number: 1 })).toBe("A001");
  });

  it("increments and keeps padding", () => {
    expect(formatQueueToken({ prefix: "A", number: 2 })).toBe("A002");
    expect(formatQueueToken({ prefix: "A", number: 3 })).toBe("A003");
  });

  it("uppercases the prefix", () => {
    expect(formatQueueToken({ prefix: "vip", number: 1 })).toBe("VIP001");
  });

  it("widens padding when the number exceeds three digits", () => {
    expect(formatQueueToken({ prefix: "A", number: 1000 })).toBe("A1000");
    expect(tokenPadWidth(1000)).toBe(4);
  });
});

describe("token sequence", () => {
  it("starts at the configured starting number", () => {
    expect(nextQueueNumber({ existingNumbers: [], startingNumber: 1 })).toBe(1);
    expect(nextQueueNumber({ existingNumbers: [], startingNumber: 10 })).toBe(
      10,
    );
  });

  it("increments from the highest existing number", () => {
    expect(
      nextQueueNumber({ existingNumbers: [1, 2, 3], startingNumber: 1 }),
    ).toBe(4);
  });

  it("parses numeric suffixes after the prefix", () => {
    expect(parseTokenNumber("VIP001", "VIP")).toBe(1);
    expect(parseTokenNumber("A010", "A")).toBe(10);
    expect(parseTokenNumber("B001", "A")).toBeNull();
  });

  it("builds the next token from existing tokens on the same prefix", () => {
    expect(
      nextQueueToken({
        prefix: "A",
        existingTokens: ["A001", "A002"],
        startingNumber: 1,
      }),
    ).toEqual({ token: "A003", number: 3 });
  });

  it("serializes concurrent claims against the same snapshot", () => {
    const existing: number[] = [];
    const first = nextQueueNumber({
      existingNumbers: existing,
      startingNumber: 1,
    });
    const afterFirst = [...existing, first];
    const second = nextQueueNumber({
      existingNumbers: afterFirst,
      startingNumber: 1,
    });
    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(first).not.toBe(second);
  });
});

describe("business date", () => {
  it("uses the branch timezone rather than UTC when they differ", () => {
    const instant = new Date("2026-09-18T18:30:00.000Z");
    expect(businessDateForTimezone(instant, "UTC")).toBe("2026-09-18");
    expect(businessDateForTimezone(instant, "Asia/Kolkata")).toBe("2026-09-19");
  });
});
