import { describe, expect, it } from "vitest";
import {
  collectObjectKeys,
  toPublicQueueStatus,
  type PublicQueueRpcStatus,
} from "@/lib/public-queue/dto";
import { PUBLIC_QUEUE_STATUS_COPY } from "@/lib/public-queue/messages";
import { isValidPublicAccessToken } from "@/lib/public-queue/paths";
import { PUBLIC_QUEUE_SENSITIVE_KEYS } from "@/lib/public-queue/types";
import type { QueueEntryStatus } from "@/lib/validations/queue";

const tokenA = "A".repeat(43);

function statusFixture(
  status: QueueEntryStatus,
  extra?: Partial<PublicQueueRpcStatus["entry"]>,
): PublicQueueRpcStatus {
  return {
    restaurant: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      logo_url: null,
    },
    branch: { name: "Demo Branch", slug: "demo-branch" },
    queue: { name: "Main Queue", status: "ACTIVE" },
    settings: {
      show_estimated_wait: true,
      show_queue_position: true,
      show_party_size: true,
      allow_customer_cancel: true,
      require_customer_phone: true,
    },
    timezone: "UTC",
    estimated_service_minutes: 10,
    allow_customer_cancel: true,
    entry: {
      id: "entry-2",
      token: "A014",
      status,
      party_size: 3,
      joined_at: "2026-09-18T10:02:00.000Z",
      ...extra,
    },
    peers: [
      {
        id: "entry-1",
        status: "WAITING",
        joined_at: "2026-09-18T10:00:00.000Z",
        party_size: 2,
        token: "A013",
      },
      {
        id: "entry-2",
        status,
        joined_at: "2026-09-18T10:02:00.000Z",
        party_size: 3,
        token: "A014",
      },
      {
        id: "serving",
        status: "CALLED",
        joined_at: "2026-09-18T09:50:00.000Z",
        party_size: 2,
        token: "A009",
      },
    ],
  };
}

describe("public queue status mapping", () => {
  it("accepts a valid access token and rejects an invalid one", () => {
    expect(isValidPublicAccessToken(tokenA)).toBe(true);
    expect(isValidPublicAccessToken("A014")).toBe(false);
    expect(isValidPublicAccessToken("not-a-token")).toBe(false);
  });

  it("computes waiting position and ETA from Phase 8 rules", () => {
    const mapped = toPublicQueueStatus(statusFixture("WAITING"));
    expect(mapped.entry.position).toBe(2);
    expect(mapped.entry.partiesAhead).toBe(1);
    expect(mapped.entry.estimatedWaitMinutes).toBe((1 + 1) * 10);
    expect(mapped.entry.nowServingToken).toBe("A009");
    expect(mapped.realtimeChannel).toBeNull();
  });

  it("maps every customer-facing status", () => {
    const statuses: QueueEntryStatus[] = [
      "WAITING",
      "CALLED",
      "SEATED",
      "COMPLETED",
      "SKIPPED",
      "CANCELLED",
      "NO_SHOW",
    ];
    for (const status of statuses) {
      const mapped = toPublicQueueStatus(statusFixture(status));
      expect(mapped.entry.status).toBe(status);
      expect(PUBLIC_QUEUE_STATUS_COPY[status].title.length).toBeGreaterThan(0);
      if (status !== "WAITING") {
        expect(mapped.entry.position).toBeNull();
        expect(mapped.entry.estimatedWaitMinutes).toBeNull();
      }
    }
  });

  it("shows a seated table label without internal ids", () => {
    const mapped = toPublicQueueStatus(
      statusFixture("SEATED", { table_number: "3", table_name: "Patio 1" }),
    );
    expect(mapped.entry.tableLabel).toMatch(/3|Patio/);
    const keys = [...collectObjectKeys(mapped)].map((key) => key.toLowerCase());
    expect(keys).not.toContain("table_id");
    expect(keys).not.toContain("id");
  });

  it("does not leak PII or staff fields", () => {
    const mapped = toPublicQueueStatus(statusFixture("WAITING"));
    const keys = [...collectObjectKeys(mapped)].map((key) =>
      key.toLowerCase().replace(/[_-]/g, ""),
    );
    for (const sensitive of PUBLIC_QUEUE_SENSITIVE_KEYS) {
      expect(keys).not.toContain(sensitive.replace(/[_-]/g, ""));
    }
  });

  it("keeps a valid realtime channel and rejects token-like channels", () => {
    const restaurantId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const queueId = "11111111-1111-1111-1111-111111111111";
    const valid = toPublicQueueStatus({
      ...statusFixture("WAITING"),
      realtime_channel: `restaurant:${restaurantId}:queue:${queueId}`,
    });
    expect(valid.realtimeChannel).toBe(
      `restaurant:${restaurantId}:queue:${queueId}`,
    );
    const blob = JSON.stringify(valid);
    expect(blob).not.toContain("entry-2");
    expect(blob).not.toContain(tokenA);

    const rejected = toPublicQueueStatus({
      ...statusFixture("WAITING"),
      realtime_channel: tokenA,
    });
    expect(rejected.realtimeChannel).toBeNull();
  });
});
