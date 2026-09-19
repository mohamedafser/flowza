import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  assertSafeRealtimeChannel,
  createReservationChannel,
} from "@/lib/realtime/channels";
import {
  createRealtimeEventDedupe,
  shouldRefreshReservationsForChange,
  toRealtimeChange,
} from "@/lib/realtime/events";
import type {
  RealtimeChange,
  RealtimeConnectionStatus,
} from "@/lib/realtime/types";
import {
  ensureRealtimeAuth,
  getRealtimeBrowserClient,
  mapChannelSubscribeStatus,
  unsubscribeChannel,
  type BrowserSupabaseClient,
} from "@/services/realtime/client";

export type ReservationRealtimeSubscribeOptions = {
  restaurantId: string;
  branchId: string;
  client?: BrowserSupabaseClient | null;
  onChange: (change: RealtimeChange) => void;
  onStatus?: (status: RealtimeConnectionStatus) => void;
};

export function subscribeToReservations(
  options: ReservationRealtimeSubscribeOptions,
): () => void {
  const { restaurantId, branchId, onChange, onStatus } = options;
  const client = options.client ?? getRealtimeBrowserClient();
  if (!client || !restaurantId || !branchId) {
    onStatus?.("disconnected");
    return () => undefined;
  }

  const topic = assertSafeRealtimeChannel(
    createReservationChannel(restaurantId, branchId),
  );
  const accept = createRealtimeEventDedupe();
  let previousConnected = false;
  let channel: RealtimeChannel | null = null;
  let cleaned = false;

  onStatus?.("connecting");

  void (async () => {
    await ensureRealtimeAuth(client);
    if (cleaned) return;

    channel = client
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const change = toRealtimeChange(payload, "reservations");
          if (!change) return;
          if (!shouldRefreshReservationsForChange(change, { branchId })) return;
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
  })();

  return () => {
    cleaned = true;
    const current = channel;
    channel = null;
    void unsubscribeChannel(client, current);
  };
}
