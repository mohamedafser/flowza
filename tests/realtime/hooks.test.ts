import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/services/realtime/queue-realtime", () => ({
  subscribeToQueue: vi.fn(() => vi.fn()),
  subscribeToPublicQueue: vi.fn(() => vi.fn()),
}));

vi.mock("@/services/realtime/table-realtime", () => ({
  subscribeToTables: vi.fn(() => vi.fn()),
}));

import {
  usePublicQueueRealtime,
  useQueueRealtime,
} from "@/hooks/realtime/use-queue-realtime";
import { useTableRealtime } from "@/hooks/realtime/use-table-realtime";
import * as queueRealtime from "@/services/realtime/queue-realtime";
import * as tableRealtime from "@/services/realtime/table-realtime";

const restaurantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const queueA = "11111111-1111-1111-1111-111111111111";
const queueB = "22222222-2222-2222-2222-222222222222";
const branchA = "33333333-3333-3333-3333-333333333333";
const branchB = "44444444-4444-4444-4444-444444444444";

describe("realtime hook lifecycle", () => {
  beforeEach(() => {
    vi.mocked(queueRealtime.subscribeToQueue).mockReset();
    vi.mocked(queueRealtime.subscribeToPublicQueue).mockReset();
    vi.mocked(tableRealtime.subscribeToTables).mockReset();
  });

  it("cleans up and resubscribes when the queue or branch changes", () => {
    const firstUnsub = vi.fn();
    const secondUnsub = vi.fn();
    vi.mocked(queueRealtime.subscribeToQueue)
      .mockReturnValueOnce(firstUnsub)
      .mockReturnValueOnce(secondUnsub);

    const { rerender, unmount } = renderHook(
      (props: { queueId: string; branchId: string }) =>
        useQueueRealtime({
          restaurantId: restaurantA,
          queueId: props.queueId,
          branchId: props.branchId,
          onChange: () => undefined,
        }),
      { initialProps: { queueId: queueA, branchId: branchA } },
    );

    expect(queueRealtime.subscribeToQueue).toHaveBeenCalledTimes(1);
    rerender({ queueId: queueB, branchId: branchB });
    expect(firstUnsub).toHaveBeenCalledTimes(1);
    expect(queueRealtime.subscribeToQueue).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(queueRealtime.subscribeToQueue).mock.calls[1]?.[0],
    ).toMatchObject({
      queueId: queueB,
      branchId: branchB,
    });
    unmount();
    expect(secondUnsub).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when a customer entry reaches a terminal state", () => {
    const unsub = vi.fn();
    vi.mocked(queueRealtime.subscribeToPublicQueue).mockReturnValue(unsub);
    const channel = `restaurant:${restaurantA}:queue:${queueA}`;
    const { rerender } = renderHook(
      (props: { enabled: boolean }) =>
        usePublicQueueRealtime({
          channel,
          enabled: props.enabled,
          onChange: () => undefined,
        }),
      { initialProps: { enabled: true } },
    );
    expect(queueRealtime.subscribeToPublicQueue).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe tables without a branch", () => {
    const { result } = renderHook(() =>
      useTableRealtime({
        restaurantId: restaurantA,
        branchId: null,
        onChange: () => undefined,
      }),
    );
    expect(result.current.status).toBe("disconnected");
    expect(tableRealtime.subscribeToTables).not.toHaveBeenCalled();
  });
});
