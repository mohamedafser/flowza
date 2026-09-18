import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  assertSafeRealtimeChannel,
  createQueueChannel,
} from "@/lib/realtime/channels";
import {
  createRealtimeEventDedupe,
  shouldRefreshQueueForChange,
  toRealtimeChange,
} from "@/lib/realtime/events";
import { REALTIME_QUEUE_CHANGED_EVENT } from "@/lib/realtime/types";
import type {
  RealtimeChange,
  RealtimeConnectionStatus,
} from "@/lib/realtime/types";
import {
  getRealtimeBrowserClient,
  mapChannelSubscribeStatus,
  unsubscribeChannel,
  type BrowserSupabaseClient,
} from "@/services/realtime/client";

export type QueueRealtimeSubscribeOptions = {
  restaurantId: string;
  queueId: string;
  branchId: string;
  client?: BrowserSupabaseClient | null;
  onChange: (change: RealtimeChange) => void;
  onStatus?: (status: RealtimeConnectionStatus) => void;
};

export function subscribeToQueue(
  options: QueueRealtimeSubscribeOptions,
): () => void {
  const { restaurantId, queueId, branchId, onChange, onStatus } = options;
  const client = options.client ?? getRealtimeBrowserClient();
  if (!client || !restaurantId || !queueId || !branchId) {
    onStatus?.("disconnected");
    return () => undefined;
  }

  const topic = assertSafeRealtimeChannel(
    createQueueChannel(restaurantId, queueId),
  );
  const accept = createRealtimeEventDedupe();
  let previousConnected = false;
  let channel: RealtimeChannel | null = null;
  let cleaned = false;

  const emit = (
    payload: unknown,
    fallbackSource?: RealtimeChange["source"],
  ) => {
    const change = toRealtimeChange(payload, fallbackSource);
    if (!change) return;
    if (
      !shouldRefreshQueueForChange(change, { queueId, branchId }) &&
      change.source !== "broadcast"
    ) {
      return;
    }
    if (!accept(change)) return;
    onChange(change);
  };

  onStatus?.("connecting");
  channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "queue_entries",
        filter: `queue_id=eq.${queueId}`,
      },
      (payload) => emit(payload, "queue_entries"),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "queues",
        filter: `id=eq.${queueId}`,
      },
      (payload) => emit(payload, "queues"),
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "restaurant_tables",
        filter: `branch_id=eq.${branchId}`,
      },
      (payload) => emit(payload, "restaurant_tables"),
    )
    .subscribe((status) => {
      if (cleaned) return;
      const mapped = mapChannelSubscribeStatus(status, previousConnected);
      if (mapped === "connected") {
        previousConnected = true;
      }
      onStatus?.(mapped);
    });

  return () => {
    cleaned = true;
    const current = channel;
    channel = null;
    void unsubscribeChannel(client, current);
  };
}

export function subscribeToPublicQueue(options: {
  channel: string;
  client?: BrowserSupabaseClient | null;
  onChange: (change: RealtimeChange) => void;
  onStatus?: (status: RealtimeConnectionStatus) => void;
}): () => void {
  const client = options.client ?? getRealtimeBrowserClient();
  if (!client) {
    options.onStatus?.("disconnected");
    return () => undefined;
  }

  let topic: string;
  try {
    topic = assertSafeRealtimeChannel(options.channel);
  } catch {
    options.onStatus?.("error");
    return () => undefined;
  }

  const accept = createRealtimeEventDedupe();
  let previousConnected = false;
  let channel: RealtimeChannel | null = null;
  let cleaned = false;

  options.onStatus?.("connecting");
  channel = client
    .channel(topic, { config: { private: false } })
    .on("broadcast", { event: REALTIME_QUEUE_CHANGED_EVENT }, () => {
      const change = {
        source: "broadcast" as const,
        eventType: "queue_changed" as const,
        recordId: null,
        queueId: null,
        branchId: null,
        queueEntryId: null,
      };
      if (!accept(change)) return;
      options.onChange(change);
    })
    .subscribe((status) => {
      if (cleaned) return;
      const mapped = mapChannelSubscribeStatus(status, previousConnected);
      if (mapped === "connected") {
        previousConnected = true;
      }
      options.onStatus?.(mapped);
    });

  return () => {
    cleaned = true;
    const current = channel;
    channel = null;
    void unsubscribeChannel(client, current);
  };
}
