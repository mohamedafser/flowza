"use client";

import { WifiOff } from "lucide-react";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { StatusBadge } from "@/components/common/StatusBadge";

export function ConnectionIndicator() {
  const { isOnline, status } = useConnectionStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-live="polite"
      title="Live queue data requires an active connection"
    >
      <WifiOff className="size-3.5 text-amber-700" />
      <StatusBadge
        label={status === "reconnecting" ? "Reconnecting" : "Offline"}
        tone="warning"
      />
    </div>
  );
}
