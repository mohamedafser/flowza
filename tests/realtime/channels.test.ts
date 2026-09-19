import { describe, expect, it } from "vitest";
import {
  assertSafeRealtimeChannel,
  createQueueChannel,
  createReservationChannel,
  createTableChannel,
  isSafeRealtimeChannel,
  parseQueueChannel,
  parseReservationChannel,
  parseTableChannel,
} from "@/lib/realtime/channels";

const restaurantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const restaurantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const queueA = "11111111-1111-1111-1111-111111111111";
const queueB = "22222222-2222-2222-2222-222222222222";
const branchA = "33333333-3333-3333-3333-333333333333";
const branchB = "44444444-4444-4444-4444-444444444444";

describe("realtime channel naming", () => {
  it("builds deterministic queue and table channels", () => {
    expect(createQueueChannel(restaurantA, queueA)).toBe(
      `restaurant:${restaurantA}:queue:${queueA}`,
    );
    expect(createTableChannel(restaurantA, branchA)).toBe(
      `restaurant:${restaurantA}:branch:${branchA}:tables`,
    );
    expect(createReservationChannel(restaurantA, branchA)).toBe(
      `restaurant:${restaurantA}:branch:${branchA}:reservations`,
    );
  });

  it("keeps restaurant A channels distinct from restaurant B", () => {
    expect(createQueueChannel(restaurantA, queueA)).not.toBe(
      createQueueChannel(restaurantB, queueA),
    );
    expect(createTableChannel(restaurantA, branchA)).not.toBe(
      createTableChannel(restaurantB, branchA),
    );
  });

  it("changes subscription scope when the branch or queue changes", () => {
    expect(createQueueChannel(restaurantA, queueA)).not.toBe(
      createQueueChannel(restaurantA, queueB),
    );
    expect(createTableChannel(restaurantA, branchA)).not.toBe(
      createTableChannel(restaurantA, branchB),
    );
  });

  it("rejects channels that include tokens or PII", () => {
    expect(
      isSafeRealtimeChannel(`restaurant:${restaurantA}:queue:${queueA}`),
    ).toBe(true);
    expect(isSafeRealtimeChannel("restaurant:demo:queue:token-abc")).toBe(
      false,
    );
    expect(isSafeRealtimeChannel(`queue:${queueA}:phone:5551234`)).toBe(false);
    expect(isSafeRealtimeChannel("guest@example.com")).toBe(false);
    expect(() =>
      assertSafeRealtimeChannel(`${queueA}:access-token-value`),
    ).toThrow(/Invalid realtime channel/);
  });

  it("parses scoped identifiers back out of a valid channel", () => {
    expect(parseQueueChannel(createQueueChannel(restaurantA, queueA))).toEqual({
      restaurantId: restaurantA,
      queueId: queueA,
    });
    expect(parseTableChannel(createTableChannel(restaurantA, branchA))).toEqual(
      { restaurantId: restaurantA, branchId: branchA },
    );
    expect(
      parseReservationChannel(createReservationChannel(restaurantA, branchA)),
    ).toEqual({ restaurantId: restaurantA, branchId: branchA });
  });
});
