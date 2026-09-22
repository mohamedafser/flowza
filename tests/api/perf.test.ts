import { describe, expect, it } from "vitest";
import { startTimer } from "@/lib/api/perf";

describe("api perf timer", () => {
  it("accumulates measured phases and totals", async () => {
    const timer = startTimer();
    await timer.measure("database", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return true;
    });
    timer.mark("transform");
    const total = timer.end();
    const snap = timer.snapshot();
    expect(snap.database).toBeGreaterThanOrEqual(4);
    expect(snap.total ?? total).toBeGreaterThanOrEqual(snap.database ?? 0);
    expect(total).toBeGreaterThan(0);
  });
});
