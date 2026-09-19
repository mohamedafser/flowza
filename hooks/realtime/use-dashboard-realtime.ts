"use client";

import { useEffect, useRef } from "react";
import type { RealtimeConnectionStatus } from "@/lib/realtime/types";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { useQueueRealtime } from "@/hooks/realtime/use-queue-realtime";
import { useTableRealtime } from "@/hooks/realtime/use-table-realtime";
import { useReservationRealtime } from "@/hooks/realtime/use-reservation-realtime";

type UseDashboardRealtimeOptions = {
  restaurantId?: string | null;
  branchId?: string | null;
  queueId?: string | null;
  enabled?: boolean;
  onRefresh: () => Promise<void> | void;
};

function mergeStatuses(
  statuses: RealtimeConnectionStatus[],
): RealtimeConnectionStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("reconnecting")) return "reconnecting";
  if (statuses.includes("connecting")) return "connecting";
  if (statuses.every((value) => value === "disconnected")) {
    return "disconnected";
  }
  if (statuses.some((value) => value === "connected")) return "connected";
  return "disconnected";
}

export function useDashboardRealtime({
  restaurantId,
  branchId,
  queueId,
  enabled = true,
  onRefresh,
}: UseDashboardRealtimeOptions) {
  const onRefreshRef = useRef(onRefresh);
  const refreshRef = useRef<ReturnType<typeof createCoalescedRefresh> | null>(
    null,
  );

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    const refresh = createCoalescedRefresh(() => onRefreshRef.current(), 250);
    refreshRef.current = refresh;
    return () => refresh.cancel();
  }, [restaurantId, branchId, queueId, enabled]);

  const requestRefresh = () => {
    refreshRef.current?.request();
  };

  const queue = useQueueRealtime({
    restaurantId,
    queueId,
    branchId,
    enabled: Boolean(enabled && restaurantId && queueId && branchId),
    onChange: requestRefresh,
  });

  const tables = useTableRealtime({
    restaurantId,
    branchId,
    enabled: Boolean(enabled && restaurantId && branchId),
    onChange: requestRefresh,
  });

  const reservations = useReservationRealtime({
    restaurantId,
    branchId,
    enabled: Boolean(enabled && restaurantId && branchId),
    onChange: requestRefresh,
  });

  const status = mergeStatuses([
    queue.status,
    tables.status,
    reservations.status,
  ]);

  return { status };
}
