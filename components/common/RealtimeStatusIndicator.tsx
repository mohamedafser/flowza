"use client";

import { REALTIME_MESSAGES } from "@/lib/realtime/messages";
import type { RealtimeConnectionStatus } from "@/lib/realtime/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";

type RealtimeStatusIndicatorProps = {
  status: RealtimeConnectionStatus;
  audience?: "staff" | "customer";
  className?: string;
};

function staffLabel(status: RealtimeConnectionStatus): string {
  switch (status) {
    case "connected":
      return REALTIME_MESSAGES.staffLive;
    case "connecting":
      return REALTIME_MESSAGES.staffConnecting;
    case "reconnecting":
      return REALTIME_MESSAGES.staffReconnecting;
    case "error":
    case "disconnected":
      return REALTIME_MESSAGES.staffOffline;
  }
}

function staffTone(
  status: RealtimeConnectionStatus,
): "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "connected":
      return "success";
    case "connecting":
    case "reconnecting":
      return "warning";
    case "error":
      return "danger";
    default:
      return "warning";
  }
}

export function RealtimeStatusIndicator({
  status,
  audience = "staff",
  className,
}: RealtimeStatusIndicatorProps) {
  if (audience === "customer") {
    if (status === "connected") {
      return (
        <p className={cn("text-muted-foreground text-sm", className)}>
          {REALTIME_MESSAGES.customerLive}
        </p>
      );
    }
    if (status === "connecting") {
      return null;
    }
    return (
      <p
        className={cn("text-sm text-amber-800 dark:text-amber-200", className)}
        role="status"
        aria-live="polite"
      >
        {REALTIME_MESSAGES.customerUnavailable}
      </p>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
      title={
        status === "connected" || status === "connecting"
          ? undefined
          : REALTIME_MESSAGES.staffUnavailable
      }
    >
      <span
        className={cn(
          "size-2 rounded-full",
          status === "connected"
            ? "bg-emerald-500"
            : status === "connecting" || status === "reconnecting"
              ? "bg-amber-500"
              : "bg-muted-foreground",
        )}
        aria-hidden
      />
      <StatusBadge label={staffLabel(status)} tone={staffTone(status)} />
    </div>
  );
}
