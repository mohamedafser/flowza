import { describe, expect, it } from "vitest";
import {
  mapAvailability,
  toPublicQueueInfo,
  toPublicQueueJoin,
  type PublicQueueRpcInfo,
  type PublicQueueRpcJoin,
} from "@/lib/public-queue/dto";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import { joinPublicQueueSchema } from "@/lib/validations/public-queue";

const infoFixture: PublicQueueRpcInfo = {
  restaurant: {
    name: "Demo Restaurant",
    slug: "demo-restaurant",
    logo_url: null,
  },
  branch: {
    name: "Demo Branch",
    slug: "demo-branch",
    address_line_1: "100 Main Street",
    city: "Demo City",
    country: "US",
  },
  queue: { name: "Main Queue", status: "ACTIVE" },
  settings: {
    queue_enabled: true,
    allow_self_check_in: true,
    require_customer_name: true,
    require_customer_phone: true,
    show_estimated_wait: true,
    show_queue_position: true,
    show_party_size: true,
    allow_customer_cancel: true,
    max_queue_capacity: 20,
    default_service_minutes: 15,
  },
  timezone: "UTC",
  is_open: true,
  waiting_count: 2,
  serving_count: 1,
  now_serving_token: "A009",
  estimated_service_minutes: 15,
  availability_reason: "ok",
  peers: [],
};

describe("public queue join mapping", () => {
  it("maps a valid join confirmation without PII", () => {
    const raw: PublicQueueRpcJoin = {
      ...infoFixture,
      queue: { name: "Main Queue", status: "ACTIVE" },
      access_token: "b".repeat(43),
      reused: false,
      entry: {
        id: "entry-1",
        token: "A014",
        status: "WAITING",
        party_size: 3,
        joined_at: "2026-09-18T10:02:00.000Z",
      },
      peers: [
        {
          id: "entry-0",
          status: "WAITING",
          joined_at: "2026-09-18T10:00:00.000Z",
          party_size: 2,
          token: "A013",
        },
        {
          id: "entry-1",
          status: "WAITING",
          joined_at: "2026-09-18T10:02:00.000Z",
          party_size: 3,
          token: "A014",
        },
      ],
    };

    const mapped = toPublicQueueJoin(raw);
    expect(mapped.accessToken).toHaveLength(43);
    expect(mapped.status.entry.token).toBe("A014");
    expect(mapped.status.entry.partySize).toBe(3);
    expect(mapped.status.entry.position).toBe(2);
    expect(mapped.statusPath).toContain("/status/");
  });

  it("returns existing-entry semantics for a reused join", () => {
    const raw: PublicQueueRpcJoin = {
      ...infoFixture,
      queue: { name: "Main Queue", status: "ACTIVE" },
      access_token: "c".repeat(43),
      reused: true,
      entry: {
        id: "entry-1",
        token: "A014",
        status: "WAITING",
        party_size: 2,
        joined_at: "2026-09-18T10:00:00.000Z",
      },
      peers: [
        {
          id: "entry-1",
          status: "WAITING",
          joined_at: "2026-09-18T10:00:00.000Z",
          party_size: 2,
          token: "A014",
        },
      ],
    };
    expect(toPublicQueueJoin(raw).reused).toBe(true);
  });
});

describe("queue availability before join", () => {
  it("allows an active open queue", () => {
    const info = toPublicQueueInfo(infoFixture);
    expect(info.availability.canJoin).toBe(true);
    expect(info.estimatedWaitMinutes).toBe(45);
  });

  it("blocks paused, closed, full, and after-hours queues", () => {
    expect(mapAvailability("paused", true).message).toBe(
      PUBLIC_QUEUE_MESSAGES.paused,
    );
    expect(mapAvailability("closed", true).canJoin).toBe(false);
    expect(mapAvailability("full", true).message).toBe(
      PUBLIC_QUEUE_MESSAGES.full,
    );
    expect(mapAvailability("outside_hours", false).message).toBe(
      PUBLIC_QUEUE_MESSAGES.outsideHours,
    );
    expect(
      toPublicQueueInfo({ ...infoFixture, availability_reason: "paused" })
        .availability.canJoin,
    ).toBe(false);
  });
});

describe("normalized phone reuse", () => {
  it("treats equivalent formatted numbers as the same stored phone", () => {
    const left = joinPublicQueueSchema({ requirePhone: true }).parse({
      name: "Ada",
      phone: "+91 9876543210",
      partySize: 2,
    });
    const right = joinPublicQueueSchema({ requirePhone: true }).parse({
      name: "Ada",
      phone: "+919876543210",
      partySize: 2,
    });
    expect(left.phone).toBe(right.phone);
  });
});
