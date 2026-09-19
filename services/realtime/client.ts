import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type BrowserSupabaseClient = SupabaseClient<Database>;

let browserClient: BrowserSupabaseClient | null = null;
let authBound = false;

/**
 * Push the browser session JWT to Realtime before postgres_changes.
 * Without this, channels can report SUBSCRIBED while RLS drops every row
 * (common with @supabase/ssr createBrowserClient on first load).
 */
export async function ensureRealtimeAuth(
  client: BrowserSupabaseClient,
): Promise<void> {
  try {
    const auth = client.auth as {
      getSession?: () => Promise<{
        data: { session: { access_token: string } | null };
      }>;
    };
    if (typeof auth.getSession !== "function") return;
    if (typeof client.realtime?.setAuth !== "function") return;

    const { data } = await auth.getSession();
    await client.realtime.setAuth(data.session?.access_token ?? null);
  } catch {
    // Public broadcast still works without a JWT.
  }
}

function bindRealtimeAuth(client: BrowserSupabaseClient) {
  if (authBound) return;
  authBound = true;

  void ensureRealtimeAuth(client);

  try {
    const auth = client.auth as {
      onAuthStateChange?: (
        callback: (
          event: string,
          session: { access_token: string } | null,
        ) => void,
      ) => { data: { subscription: { unsubscribe: () => void } } };
    };
    auth.onAuthStateChange?.((_event, session) => {
      void client.realtime.setAuth(session?.access_token ?? null);
    });
  } catch {
    // ensureRealtimeAuth still runs per subscription.
  }
}

export function getRealtimeBrowserClient(): BrowserSupabaseClient | null {
  try {
    if (!browserClient) {
      browserClient = createClient();
      bindRealtimeAuth(browserClient);
    }
    return browserClient;
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
