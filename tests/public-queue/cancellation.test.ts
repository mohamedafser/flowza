import { describe, expect, it } from "vitest";
import { canTransitionQueueStatus } from "@/lib/queue/transitions";
import {
  toPublicQueueStatus,
  type PublicQueueRpcStatus,
} from "@/lib/public-queue/dto";

function fixture(
  status: PublicQueueRpcStatus["entry"]["status"],
  allowCancel: boolean,
): PublicQueueRpcStatus {
  return {
    restaurant: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      logo_url: null,
    },
    branch: { name: "Demo Branch", slug: "demo-branch" },
    queue: { name: "Main Queue", status: "ACTIVE" },
    settings: { allow_customer_cancel: allowCancel },
    timezone: "UTC",
    estimated_service_minutes: 15,
    allow_customer_cancel: allowCancel,
    entry: {
      id: "entry-1",
      token: "A014",
      status,
      party_size: 2,
      joined_at: "2026-09-18T10:00:00.000Z",
    },
    peers: [
      {
        id: "entry-1",
        status,
        joined_at: "2026-09-18T10:00:00.000Z",
        party_size: 2,
        token: "A014",
      },
    ],
  };
}

describe("public queue cancellation rules", () => {
  it("allows waiting and called guests to cancel when enabled", () => {
    expect(toPublicQueueStatus(fixture("WAITING", true)).entry.canCancel).toBe(
      true,
    );
    expect(toPublicQueueStatus(fixture("CALLED", true)).entry.canCancel).toBe(
      true,
    );
    expect(canTransitionQueueStatus("WAITING", "CANCELLED")).toBe(true);
    expect(canTransitionQueueStatus("CALLED", "CANCELLED")).toBe(true);
  });

  it("hides cancellation when the restaurant disabled it", () => {
    expect(toPublicQueueStatus(fixture("WAITING", false)).entry.canCancel).toBe(
      false,
    );
  });

  it("blocks cancellation from terminal or seated states", () => {
    expect(toPublicQueueStatus(fixture("SEATED", true)).entry.canCancel).toBe(
      false,
    );
    expect(
      toPublicQueueStatus(fixture("COMPLETED", true)).entry.canCancel,
    ).toBe(false);
    expect(toPublicQueueStatus(fixture("SKIPPED", true)).entry.canCancel).toBe(
      false,
    );
    expect(
      toPublicQueueStatus(fixture("CANCELLED", true)).entry.canCancel,
    ).toBe(false);
    expect(toPublicQueueStatus(fixture("NO_SHOW", true)).entry.canCancel).toBe(
      false,
    );
    expect(canTransitionQueueStatus("SEATED", "CANCELLED")).toBe(false);
    expect(canTransitionQueueStatus("COMPLETED", "CANCELLED")).toBe(false);
  });
});
