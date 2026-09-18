"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RealtimeChange,
  RealtimeConnectionStatus,
} from "@/lib/realtime/types";
import {
  subscribeToPublicQueue,
  subscribeToQueue,
} from "@/services/realtime/queue-realtime";

type UseQueueRealtimeOptions = {
  restaurantId?: string | null;
  queueId?: string | null;
  branchId?: string | null;
  enabled?: boolean;
  onChange: (change: RealtimeChange) => void;
};

export function useQueueRealtime({
  restaurantId,
  queueId,
  branchId,
  enabled = true,
  onChange,
}: UseQueueRealtimeOptions) {
  const active = Boolean(enabled && restaurantId && queueId && branchId);
  const [channelStatus, setChannelStatus] =
    useState<RealtimeConnectionStatus>("connecting");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!active || !restaurantId || !queueId || !branchId) {
      return;
    }

    return subscribeToQueue({
      restaurantId,
      queueId,
      branchId,
      onChange: (change) => onChangeRef.current(change),
      onStatus: setChannelStatus,
    });
  }, [active, restaurantId, queueId, branchId]);

  return { status: active ? channelStatus : "disconnected" };
}

type UsePublicQueueRealtimeOptions = {
  channel?: string | null;
  enabled?: boolean;
  onChange: (change: RealtimeChange) => void;
};

export function usePublicQueueRealtime({
  channel,
  enabled = true,
  onChange,
}: UsePublicQueueRealtimeOptions) {
  const active = Boolean(enabled && channel);
  const [channelStatus, setChannelStatus] =
    useState<RealtimeConnectionStatus>("connecting");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!active || !channel) {
      return;
    }

    return subscribeToPublicQueue({
      channel,
      onChange: (change) => onChangeRef.current(change),
      onStatus: setChannelStatus,
    });
  }, [active, channel]);

  return { status: active ? channelStatus : "disconnected" };
}
