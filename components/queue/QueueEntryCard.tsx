"use client";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  formatWaitMinutes,
  queueEntryStatusLabel,
  queueEntryStatusTone,
  queueTableLabel,
} from "@/lib/utils/queue";
import { queueActionsForStatus } from "@/lib/queue/transitions";
import { formatTime, type TimeFormat } from "@/lib/utils/datetime";
import type { QueueEntryView } from "@/services/queues";

type QueueEntryCardProps = {
  entry: QueueEntryView;
  timezone: string;
  timeFormat: TimeFormat;
  canManage: boolean;
  pending: boolean;
  onOpen: () => void;
  onCall: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onSeat: () => void;
  onNoShow: () => void;
  onComplete: () => void;
};

export function QueueEntryCard({
  entry,
  timezone,
  timeFormat,
  canManage,
  pending,
  onOpen,
  onCall,
  onSkip,
  onCancel,
  onSeat,
  onNoShow,
  onComplete,
}: QueueEntryCardProps) {
  const actions = queueActionsForStatus(entry.status);
  const joined = formatTime(new Date(entry.joined_at), timeFormat, timezone);

  return (
    <article className="border-border bg-card rounded-xl border p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <p className="font-mono text-2xl font-semibold tracking-tight">
            {entry.token}
          </p>
          <p className="truncate text-sm font-medium">
            {entry.customer?.name ?? "Guest"}
          </p>
        </button>
        <StatusBadge
          label={queueEntryStatusLabel(entry.status)}
          tone={queueEntryStatusTone(entry.status)}
        />
      </div>
      <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <dt>Party</dt>
          <dd className="text-foreground">{entry.party_size}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd className="text-foreground">{entry.position ?? "—"}</dd>
        </div>
        <div>
          <dt>Wait</dt>
          <dd className="text-foreground">
            {formatWaitMinutes(entry.estimatedWaitMinutes)}
          </dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd className="text-foreground">{joined}</dd>
        </div>
      </dl>
      {entry.table ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Table {queueTableLabel(entry.table)}
        </p>
      ) : null}
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.canCall ? (
            <Button size="sm" disabled={pending} onClick={onCall}>
              Call
            </Button>
          ) : null}
          {actions.canSeat ? (
            <Button size="sm" disabled={pending} onClick={onSeat}>
              Seat
            </Button>
          ) : null}
          {actions.canComplete ? (
            <Button size="sm" disabled={pending} onClick={onComplete}>
              Complete
            </Button>
          ) : null}
          {actions.canSkip ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onSkip}
            >
              Skip
            </Button>
          ) : null}
          {actions.canNoShow ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onNoShow}
            >
              No show
            </Button>
          ) : null}
          {actions.canCancel ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
