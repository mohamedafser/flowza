import { describe, expect, it, vi } from "vitest";
import {
  createRealtimeEventDedupe,
  payloadContainsSensitiveKeys,
  shouldRefreshQueueForChange,
  shouldRefreshTablesForChange,
  toRealtimeChange,
  upsertById,
} from "@/lib/realtime/events";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import type { RealtimeChange } from "@/lib/realtime/types";

const queueA = "11111111-1111-1111-1111-111111111111";
const queueB = "22222222-2222-2222-2222-222222222222";
const branchA = "33333333-3333-3333-3333-333333333333";
const branchB = "44444444-4444-4444-4444-444444444444";

function change(
  partial: Partial<RealtimeChange> & Pick<RealtimeChange, "source">,
): RealtimeChange {
  return {
    eventType: "UPDATE",
    recordId: "entry-1",
    queueId: queueA,
    branchId: branchA,
    queueEntryId: null,
    ...partial,
  };
}

describe("realtime payload sanitization", () => {
  it("extracts identifiers and drops row bodies", () => {
    const mapped = toRealtimeChange({
      eventType: "UPDATE",
      table: "queue_entries",
      new: {
        id: "entry-1",
        queue_id: queueA,
        public_access_token: "secret-token",
        phone: "555-0100",
        email: "ada@example.com",
        customer_id: "cust-1",
      },
    });
    expect(mapped).toEqual({
      source: "queue_entries",
      eventType: "UPDATE",
      recordId: "entry-1",
      queueId: queueA,
      branchId: null,
      queueEntryId: null,
    });
    expect(JSON.stringify(mapped)).not.toContain("secret-token");
    expect(JSON.stringify(mapped)).not.toContain("555-0100");
    expect(JSON.stringify(mapped)).not.toContain("ada@example.com");
  });

  it("detects sensitive keys in raw payloads", () => {
    expect(
      payloadContainsSensitiveKeys({
        phone: "555",
        nested: { public_access_token: "x" },
      }),
    ).toBe(true);
    expect(payloadContainsSensitiveKeys({ source: "queue_entries" })).toBe(
      false,
    );
  });
});

describe("realtime tenant and branch isolation", () => {
  it("does not refresh restaurant B queue events on restaurant A screens", () => {
    expect(
      shouldRefreshQueueForChange(
        change({ source: "queue_entries", queueId: queueB }),
        { queueId: queueA, branchId: branchA },
      ),
    ).toBe(false);
  });

  it("does not refresh another branch's tables", () => {
    expect(
      shouldRefreshTablesForChange(
        change({ source: "restaurant_tables", branchId: branchB }),
        { branchId: branchA },
      ),
    ).toBe(false);
    expect(
      shouldRefreshTablesForChange(
        change({ source: "restaurant_tables", branchId: branchA }),
        { branchId: branchA },
      ),
    ).toBe(true);
  });
});

describe("duplicate realtime events", () => {
  it("ignores repeated events for the same record", () => {
    const accept = createRealtimeEventDedupe(5_000);
    const event = change({ source: "queue_entries" });
    expect(accept(event)).toBe(true);
    expect(accept(event)).toBe(false);
  });

  it("replaces queue entries by stable id instead of appending duplicates", () => {
    const first = { id: "entry-1", token: "A001", status: "WAITING" };
    const updated = { id: "entry-1", token: "A001", status: "CALLED" };
    const next = upsertById([first], updated);
    expect(next).toHaveLength(1);
    expect(next[0]?.status).toBe("CALLED");
    expect(upsertById(next, first)).toHaveLength(1);
  });
});

describe("coalesced refresh", () => {
  it("deduplicates overlapping refresh requests", async () => {
    vi.useFakeTimers();
    let inflight = 0;
    let started = 0;
    const { request, cancel } = createCoalescedRefresh(async () => {
      started += 1;
      inflight += 1;
      expect(inflight).toBe(1);
      await Promise.resolve();
      inflight -= 1;
    }, 20);

    request();
    request();
    request();
    await vi.advanceTimersByTimeAsync(25);
    await Promise.resolve();
    expect(started).toBe(1);
    cancel();
    vi.useRealTimers();
  });

  it("does not run after cancel, preventing leaked loops", async () => {
    vi.useFakeTimers();
    let started = 0;
    const { request, cancel } = createCoalescedRefresh(() => {
      started += 1;
    }, 20);
    request();
    cancel();
    await vi.advanceTimersByTimeAsync(50);
    expect(started).toBe(0);
    vi.useRealTimers();
  });
});
