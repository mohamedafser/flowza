"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QueueTokenCard } from "@/components/public-queue/QueueTokenCard";
import { CancelQueueDialog } from "@/components/public-queue/CancelQueueDialog";
import { RealtimeStatusIndicator } from "@/components/common/RealtimeStatusIndicator";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  cancelPublicQueueRequest,
  fetchPublicQueueStatus,
} from "@/lib/api/public-queue-client";
import {
  PUBLIC_QUEUE_STATUS_COPY,
  PUBLIC_QUEUE_STATUS_POLLABLE,
} from "@/lib/public-queue/messages";
import { PUBLIC_QUEUE_FALLBACK_INTERVAL_MS } from "@/lib/public-queue/paths";
import { usePublicQueueRealtime } from "@/hooks/realtime/use-queue-realtime";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { REALTIME_REFRESH_DEBOUNCE_MS } from "@/lib/realtime/types";
import { formatWaitMinutes, queueEntryStatusTone } from "@/lib/utils/queue";
import { QUEUE_ENTRY_STATUS_LABELS } from "@/lib/validations/queue";
import type { PublicQueueStatusResponse } from "@/lib/public-queue/types";
import { cn } from "@/lib/utils";

type QueueStatusViewProps = {
  accessToken: string;
  initial: PublicQueueStatusResponse;
};

export function QueueStatusView({
  accessToken,
  initial,
}: QueueStatusViewProps) {
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const refreshController = useRef<ReturnType<
    typeof createCoalescedRefresh
  > | null>(null);

  const liveEnabled = PUBLIC_QUEUE_STATUS_POLLABLE.has(status.entry.status);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await fetchPublicQueueStatus(accessToken);
      if (!result.ok || !result.data) {
        return;
      }
      setStatus(result.data);
    } finally {
      inFlight.current = false;
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = createCoalescedRefresh(
      refresh,
      REALTIME_REFRESH_DEBOUNCE_MS,
    );
    refreshController.current = controller;
    return () => {
      controller.cancel();
      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    };
  }, [refresh]);

  const { status: realtimeStatus } = usePublicQueueRealtime({
    channel: status.realtimeChannel,
    enabled: liveEnabled && Boolean(status.realtimeChannel),
    onChange: () => {
      refreshController.current?.request();
    },
  });

  useEffect(() => {
    if (!liveEnabled) return;
    if (realtimeStatus === "connected") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          refreshController.current?.request();
        }
        if (!cancelled) loop();
      }, PUBLIC_QUEUE_FALLBACK_INTERVAL_MS);
    };

    const onVisibility = () => {
      if (!cancelled && document.visibilityState === "visible") {
        refreshController.current?.request();
      }
    };

    loop();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [liveEnabled, realtimeStatus]);

  const copy = PUBLIC_QUEUE_STATUS_COPY[status.entry.status];
  const live = status.entry.status === "CALLED" ? "assertive" : "polite";

  const onCancel = async () => {
    setPending(true);
    try {
      const result = await cancelPublicQueueRequest(accessToken);
      if (!result.ok || !result.data) {
        toast.error(result.message ?? "Unable to cancel this entry.");
        return;
      }
      setStatus(result.data);
      toast.success("Queue entry cancelled.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-2xl border p-4",
          status.entry.status === "CALLED"
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
            : "border-border bg-card",
        )}
        aria-live={live}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {copy.title}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {copy.description}
            </p>
          </div>
          <StatusBadge
            label={QUEUE_ENTRY_STATUS_LABELS[status.entry.status]}
            tone={queueEntryStatusTone(status.entry.status)}
          />
        </div>
      </div>

      <QueueTokenCard token={status.entry.token} />

      {liveEnabled ? (
        <RealtimeStatusIndicator status={realtimeStatus} audience="customer" />
      ) : null}

      <dl className="border-border bg-card grid grid-cols-2 gap-3 rounded-2xl border p-4">
        {status.settings.showQueuePosition && status.entry.position != null ? (
          <div>
            <dt className="text-muted-foreground text-sm">Position</dt>
            <dd className="text-2xl font-semibold">{status.entry.position}</dd>
          </div>
        ) : null}
        {status.settings.showQueuePosition &&
        status.entry.partiesAhead != null ? (
          <div>
            <dt className="text-muted-foreground text-sm">People ahead</dt>
            <dd className="text-2xl font-semibold">
              {status.entry.partiesAhead}
            </dd>
          </div>
        ) : null}
        {status.settings.showEstimatedWait ? (
          <div>
            <dt className="text-muted-foreground text-sm">Estimated wait</dt>
            <dd className="text-lg font-semibold">
              {status.entry.estimatedWaitMinutes == null
                ? "Estimated wait unavailable"
                : formatWaitMinutes(status.entry.estimatedWaitMinutes)}
            </dd>
          </div>
        ) : null}
        {status.settings.showPartySize ? (
          <div>
            <dt className="text-muted-foreground text-sm">Party size</dt>
            <dd className="text-lg font-semibold">{status.entry.partySize}</dd>
          </div>
        ) : null}
        {status.entry.nowServingToken ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground text-sm">Now serving</dt>
            <dd className="font-mono text-xl font-semibold tracking-wide">
              {status.entry.nowServingToken}
            </dd>
          </div>
        ) : null}
        {status.entry.tableLabel &&
        (status.entry.status === "CALLED" ||
          status.entry.status === "SEATED") ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground text-sm">Table</dt>
            <dd className="text-lg font-semibold">{status.entry.tableLabel}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full text-base"
          onClick={() => {
            void refresh();
          }}
        >
          <RefreshCw className="size-4" />
          Refresh status
        </Button>
        {status.entry.canCancel ? (
          <CancelQueueDialog pending={pending} onConfirm={onCancel} />
        ) : null}
      </div>
    </div>
  );
}
