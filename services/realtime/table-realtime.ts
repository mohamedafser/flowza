import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  assertSafeRealtimeChannel,
  createTableChannel,
} from "@/lib/realtime/channels";
import {
  createRealtimeEventDedupe,
  shouldRefreshTablesForChange,
  toRealtimeChange,
} from "@/lib/realtime/events";
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

export type TableRealtimeSubscribeOptions = {
  restaurantId: string;
  branchId: string;
  client?: BrowserSupabaseClient | null;
  onChange: (change: RealtimeChange) => void;
  onStatus?: (status: RealtimeConnectionStatus) => void;
};

export function subscribeToTables(
  options: TableRealtimeSubscribeOptions,
): () => void {
  const { restaurantId, branchId, onChange, onStatus } = options;
  const client = options.client ?? getRealtimeBrowserClient();
  if (!client || !restaurantId || !branchId) {
    onStatus?.("disconnected");
    return () => undefined;
  }

  const topic = assertSafeRealtimeChannel(
    createTableChannel(restaurantId, branchId),
  );
  const accept = createRealtimeEventDedupe();
  let previousConnected = false;
  let channel: RealtimeChannel | null = null;
  let cleaned = false;

  onStatus?.("connecting");
  channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "restaurant_tables",
        filter: `branch_id=eq.${branchId}`,
      },
      (payload) => {
        const change = toRealtimeChange(payload, "restaurant_tables");
        if (!change) return;
        if (!shouldRefreshTablesForChange(change, { branchId })) return;
        if (!accept(change)) return;
        onChange(change);
      },
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
