"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { ConnectionStatus } from "@/types";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Tracks browser connectivity. Realtime reconnect state lives in
 * `useQueueRealtime` / `useTableRealtime`.
 */
export function useConnectionStatus() {
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [reconnecting, setReconnecting] = useState(false);

  const status: ConnectionStatus = !isOnline
    ? "offline"
    : reconnecting
      ? "reconnecting"
      : "online";

  const refresh = useCallback(() => {
    setReconnecting(false);
  }, []);

  const markReconnecting = useCallback(() => {
    setReconnecting(true);
  }, []);

  return {
    status,
    isOnline,
    refresh,
    markReconnecting,
  };
}
