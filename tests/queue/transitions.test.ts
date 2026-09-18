import { describe, expect, it } from "vitest";
import {
  allowedQueueTransitions,
  canTransitionQueueStatus,
  queueActionsForStatus,
} from "@/lib/queue/transitions";
import { QUEUE_ENTRY_STATUSES } from "@/lib/validations/queue";

describe("queue status transitions", () => {
  it("allows the primary serving flow", () => {
    expect(canTransitionQueueStatus("WAITING", "CALLED")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "SEATED")).toBe(true);
    expect(canTransitionQueueStatus("SEATED", "COMPLETED")).toBe(true);
  });

  it("allows waiting and called alternative outcomes", () => {
    expect(canTransitionQueueStatus("WAITING", "SKIPPED")).toBe(true);
    expect(canTransitionQueueStatus("WAITING", "CANCELLED")).toBe(true);
    expect(canTransitionQueueStatus("WAITING", "NO_SHOW")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "NO_SHOW")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "SKIPPED")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "CANCELLED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionQueueStatus("WAITING", "SEATED")).toBe(false);
    expect(canTransitionQueueStatus("WAITING", "COMPLETED")).toBe(false);
    expect(canTransitionQueueStatus("SEATED", "CALLED")).toBe(false);
    expect(canTransitionQueueStatus("COMPLETED", "WAITING")).toBe(false);
    expect(canTransitionQueueStatus("SKIPPED", "CALLED")).toBe(false);
    expect(canTransitionQueueStatus("CANCELLED", "SEATED")).toBe(false);
    expect(canTransitionQueueStatus("NO_SHOW", "COMPLETED")).toBe(false);
    expect(canTransitionQueueStatus("SEATED", "SKIPPED")).toBe(false);
  });

  it("treats same-status as idempotent", () => {
    for (const status of QUEUE_ENTRY_STATUSES) {
      expect(canTransitionQueueStatus(status, status)).toBe(true);
    }
  });

  it("exposes actions matching allowed targets", () => {
    const waiting = queueActionsForStatus("WAITING");
    expect(waiting.canCall).toBe(true);
    expect(waiting.canSeat).toBe(false);
    expect(waiting.canComplete).toBe(false);
    expect(allowedQueueTransitions("SEATED")).toEqual(["COMPLETED"]);
  });
});
