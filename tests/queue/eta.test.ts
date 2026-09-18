import { describe, expect, it } from "vitest";
import {
  estimateWaitMinutesForPosition,
  estimateWaitTime,
} from "@/lib/queue/estimateWaitTime";
import { sortWaitingEntries } from "@/lib/utils/queue";
import type { QueueEntryStatus } from "@/lib/validations/queue";

function entry(
  id: string,
  status: QueueEntryStatus,
  joinedAt: string,
): {
  id: string;
  status: QueueEntryStatus;
  joined_at: string;
  party_size: number;
  token: string;
} {
  return {
    id,
    status,
    joined_at: joinedAt,
    party_size: 2,
    token: id,
  };
}

describe("queue position and ETA", () => {
  const entries = [
    entry("a", "WAITING", "2026-09-18T10:00:00.000Z"),
    entry("b", "WAITING", "2026-09-18T10:01:00.000Z"),
    entry("c", "WAITING", "2026-09-18T10:02:00.000Z"),
    entry("s", "SEATED", "2026-09-18T09:50:00.000Z"),
  ];

  it("orders waiting guests by joined_at then id", () => {
    expect(sortWaitingEntries(entries).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("calculates 1-based position from waiting parties ahead", () => {
    const first = estimateWaitTime({
      entries,
      entryId: "a",
      estimatedServiceMinutes: 15,
    });
    const third = estimateWaitTime({
      entries,
      entryId: "c",
      estimatedServiceMinutes: 15,
    });
    expect(first.position).toBe(1);
    expect(first.partiesAhead).toBe(0);
    expect(third.position).toBe(3);
    expect(third.partiesAhead).toBe(2);
  });

  it("estimates wait as parties ahead plus currently serving times duration", () => {
    const second = estimateWaitTime({
      entries,
      entryId: "b",
      estimatedServiceMinutes: 10,
    });
    expect(second.estimatedWaitMinutes).toBe((1 + 1) * 10);
    expect(
      estimateWaitMinutesForPosition({
        position: 2,
        servingCount: 1,
        estimatedServiceMinutes: 10,
      }),
    ).toBe(20);
  });

  it("does not estimate wait for non-waiting entries", () => {
    expect(
      estimateWaitTime({
        entries,
        entryId: "s",
        estimatedServiceMinutes: 15,
      }).position,
    ).toBeNull();
  });
});
