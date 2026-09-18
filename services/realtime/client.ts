import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type BrowserSupabaseClient = SupabaseClient<Database>;

export function getRealtimeBrowserClient(): BrowserSupabaseClient | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export function mapChannelSubscribeStatus(
  status: string,
  previouslyConnected: boolean,
): "connecting" | "connected" | "reconnecting" | "disconnected" | "error" {
  switch (status) {
    case "SUBSCRIBED":
      return "connected";
    case "CLOSED":
      return previouslyConnected ? "reconnecting" : "disconnected";
    case "TIMED_OUT":
    case "CHANNEL_ERROR":
      return previouslyConnected ? "reconnecting" : "error";
    default:
      return previouslyConnected ? "reconnecting" : "connecting";
  }
}

export async function unsubscribeChannel(
  client: BrowserSupabaseClient,
  channel: RealtimeChannel | null | undefined,
): Promise<void> {
  if (!channel) return;
  try {
    await client.removeChannel(channel);
  } catch {
    try {
      channel.unsubscribe();
    } catch {
      // Best-effort cleanup; dropped sockets should not throw in UI.
    }
  }
}
