"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Loader2 } from "lucide-react";
import {
  formatWaitMinutes,
  queueEntryStatusLabel,
  queueEntryStatusTone,
  queueTableLabel,
} from "@/lib/utils/queue";
import { queueActionsForStatus } from "@/lib/queue/transitions";
import {
  formatDate,
  formatTime,
  type DateFormat,
  type TimeFormat,
} from "@/lib/utils/datetime";
import type { QueueEntryView } from "@/services/queues";

type QueueEntryDetailsProps = {
  entry: QueueEntryView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  canManage: boolean;
  pending: boolean;
  loadingAction?: "call" | "complete" | null;
  onCall: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onSeat: () => void;
  onNoShow: () => void;
  onComplete: () => void;
};

function stamp(
  value: string | null,
  timezone: string,
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
): string {
  if (!value) return "—";
  const instant = new Date(value);
  return `${formatDate(instant, dateFormat, timezone)} ${formatTime(instant, timeFormat, timezone)}`;
}

export function QueueEntryDetails({
  entry,
  open,
  onOpenChange,
  timezone,
  dateFormat,
  timeFormat,
  canManage,
  pending,
  loadingAction = null,
  onCall,
  onSkip,
  onCancel,
  onSeat,
  onNoShow,
  onComplete,
}: QueueEntryDetailsProps) {
  const actions = entry ? queueActionsForStatus(entry.status) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-2xl">
            {entry?.token ?? "Queue entry"}
          </DialogTitle>
          <DialogDescription>
            {entry?.customer?.name ?? "Guest"} · party of{" "}
            {entry?.party_size ?? "—"}
          </DialogDescription>
        </DialogHeader>
        {entry ? (
          <div className="space-y-4">
            <StatusBadge
              label={queueEntryStatusLabel(entry.status)}
              tone={queueEntryStatusTone(entry.status)}
            />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Position</dt>
                <dd>{entry.position ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estimated wait</dt>
                <dd>{formatWaitMinutes(entry.estimatedWaitMinutes)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Joined</dt>
                <dd>
                  {stamp(entry.joined_at, timezone, dateFormat, timeFormat)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Called</dt>
                <dd>
                  {stamp(entry.called_at, timezone, dateFormat, timeFormat)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Seated</dt>
                <dd>
                  {stamp(entry.seated_at, timezone, dateFormat, timeFormat)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Completed</dt>
                <dd>
                  {stamp(entry.completed_at, timezone, dateFormat, timeFormat)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Table</dt>
                <dd>{queueTableLabel(entry.table) ?? "Not assigned"}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {canManage && actions ? (
          <DialogFooter className="gap-2 sm:flex-wrap">
            {actions.canCall ? (
              <Button
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={onCall}
                aria-busy={loadingAction === "call"}
              >
                {loadingAction === "call" ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : null}
                {loadingAction === "call" ? "Calling…" : "Call"}
              </Button>
            ) : null}
            {actions.canSeat ? (
              <Button
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={onSeat}
              >
                Seat
              </Button>
            ) : null}
            {actions.canComplete ? (
              <Button
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={onComplete}
                aria-busy={loadingAction === "complete"}
              >
                {loadingAction === "complete" ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : null}
                {loadingAction === "complete" ? "Completing…" : "Complete"}
              </Button>
            ) : null}
            {actions.canSkip ? (
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                disabled={pending}
                onClick={onSkip}
              >
                Skip
              </Button>
            ) : null}
            {actions.canNoShow ? (
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                disabled={pending}
                onClick={onNoShow}
              >
                No show
              </Button>
            ) : null}
            {actions.canCancel ? (
              <Button
                className="w-full sm:w-auto"
                variant="destructive"
                disabled={pending}
                onClick={onCancel}
              >
                Cancel
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
