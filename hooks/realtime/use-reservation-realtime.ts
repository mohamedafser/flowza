"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RealtimeChange,
  RealtimeConnectionStatus,
} from "@/lib/realtime/types";
import { subscribeToReservations } from "@/services/realtime/reservation-realtime";

type UseReservationRealtimeOptions = {
  restaurantId?: string | null;
  branchId?: string | null;
  enabled?: boolean;
  onChange: (change: RealtimeChange) => void;
};

export function useReservationRealtime({
  restaurantId,
  branchId,
  enabled = true,
  onChange,
}: UseReservationRealtimeOptions) {
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

    return subscribeToReservations({
      restaurantId,
      branchId,
      onChange: (change) => onChangeRef.current(change),
      onStatus: setChannelStatus,
    });
  }, [active, restaurantId, branchId]);

  return { status: active ? channelStatus : "disconnected" };
}
