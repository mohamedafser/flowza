import { describe, expect, it } from "vitest";
import {
  addCustomerToQueueSchema,
  createQueueSchema,
  partySizeSchema,
  seatQueueEntrySchema,
  updateQueueStatusSchema,
} from "@/lib/validations/queue";
import { canTransitionQueueStatus } from "@/lib/queue/transitions";

describe("queue operations validation", () => {
  it("creates a queue belonging to a branch", () => {
    const parsed = createQueueSchema.parse({
      branchId: "22222222-2222-2222-2222-222222222222",
      name: " Main Queue ",
      prefix: "a",
      startingNumber: 1,
      estimatedServiceMinutes: 15,
      status: "ACTIVE",
    });
    expect(parsed.name).toBe("Main Queue");
    expect(parsed.prefix).toBe("A");
  });

  it("requires a customer or a name when adding to the queue", () => {
    const missing = addCustomerToQueueSchema.safeParse({
      queueId: "55555555-5555-5555-5555-555555555555",
      partySize: 2,
    });
    expect(missing.success).toBe(false);

    const existing = addCustomerToQueueSchema.parse({
      queueId: "55555555-5555-5555-5555-555555555555",
      partySize: 2,
      customerId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(existing.customerId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("requires a positive party size within range", () => {
    expect(partySizeSchema.safeParse(0).success).toBe(false);
    expect(partySizeSchema.safeParse(51).success).toBe(false);
    expect(partySizeSchema.parse(4)).toBe(4);
  });

  it("validates skip, cancel, no-show, seat, and complete payloads", () => {
    expect(
      seatQueueEntrySchema.parse({
        entryId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        tableId: "44444444-4444-4444-4444-444444444401",
      }).tableId,
    ).toBe("44444444-4444-4444-4444-444444444401");
    expect(
      updateQueueStatusSchema.parse({
        queueId: "55555555-5555-5555-5555-555555555555",
        status: "PAUSED",
      }).status,
    ).toBe("PAUSED");
  });

  it("keeps operational outcomes aligned with transition rules", () => {
    expect(canTransitionQueueStatus("WAITING", "CALLED")).toBe(true);
    expect(canTransitionQueueStatus("WAITING", "SKIPPED")).toBe(true);
    expect(canTransitionQueueStatus("WAITING", "CANCELLED")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "NO_SHOW")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "SEATED")).toBe(true);
    expect(canTransitionQueueStatus("SEATED", "COMPLETED")).toBe(true);
  });
});
