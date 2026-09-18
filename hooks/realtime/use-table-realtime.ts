"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RealtimeChange,
  RealtimeConnectionStatus,
} from "@/lib/realtime/types";
import { subscribeToTables } from "@/services/realtime/table-realtime";

type UseTableRealtimeOptions = {
  restaurantId?: string | null;
  branchId?: string | null;
  enabled?: boolean;
  onChange: (change: RealtimeChange) => void;
};

export function useTableRealtime({
  restaurantId,
  branchId,
  enabled = true,
  onChange,
}: UseTableRealtimeOptions) {
  const active = Boolean(enabled && restaurantId && branchId);
  const [channelStatus, setChannelStatus] =
    useState<RealtimeConnectionStatus>("connecting");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!active || !restaurantId || !branchId) {
      return;
    }

    return subscribeToTables({
      restaurantId,
      branchId,
      onChange: (change) => onChangeRef.current(change),
      onStatus: setChannelStatus,
    });
  }, [active, restaurantId, branchId]);

  return { status: active ? channelStatus : "disconnected" };
}
