"use client";

import {
  Ban,
  CheckCircle2,
  Megaphone,
  SkipForward,
  UserX,
  Utensils,
} from "lucide-react";
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
    <article className="border-border bg-card min-w-0 rounded-xl border p-3 shadow-xs sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <p className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
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
      <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
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
        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          {actions.canCall ? (
            <Button size="sm" disabled={pending} onClick={onCall}>
              <Megaphone />
              Call
            </Button>
          ) : null}
          {actions.canSeat ? (
            <Button size="sm" disabled={pending} onClick={onSeat}>
              <Utensils />
              Seat
            </Button>
          ) : null}
          {actions.canComplete ? (
            <Button size="sm" disabled={pending} onClick={onComplete}>
              <CheckCircle2 />
              Complete
            </Button>
          ) : null}
          {actions.canSkip ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onSkip}
              aria-label="Skip"
            >
              <SkipForward />
              <span className="hidden min-[400px]:inline">Skip</span>
            </Button>
          ) : null}
          {actions.canNoShow ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onNoShow}
              aria-label="No show"
            >
              <UserX />
              <span className="hidden min-[400px]:inline">No show</span>
            </Button>
          ) : null}
          {actions.canCancel ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onCancel}
              aria-label="Cancel"
            >
              <Ban />
              <span className="hidden min-[400px]:inline">Cancel</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
