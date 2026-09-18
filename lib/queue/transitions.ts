import {
  QUEUE_ENTRY_STATUSES,
  type QueueEntryStatus,
} from "@/lib/validations/queue";

const QUEUE_STATUS_TRANSITIONS: Record<
  QueueEntryStatus,
  readonly QueueEntryStatus[]
> = {
  WAITING: ["CALLED", "SKIPPED", "CANCELLED", "NO_SHOW"],
  CALLED: ["SEATED", "SKIPPED", "CANCELLED", "NO_SHOW"],
  SEATED: ["COMPLETED"],
  COMPLETED: [],
  SKIPPED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function isQueueEntryStatus(value: unknown): value is QueueEntryStatus {
  return (
    typeof value === "string" &&
    (QUEUE_ENTRY_STATUSES as readonly string[]).includes(value)
  );
}

export function allowedQueueTransitions(
  from: QueueEntryStatus,
): readonly QueueEntryStatus[] {
  return QUEUE_STATUS_TRANSITIONS[from];
}

export function canTransitionQueueStatus(
  from: QueueEntryStatus,
  to: QueueEntryStatus,
): boolean {
  if (from === to) {
    return true;
  }
  if (!isQueueEntryStatus(from) || !isQueueEntryStatus(to)) {
    return false;
  }
  return QUEUE_STATUS_TRANSITIONS[from].includes(to);
}

export function queueActionsForStatus(status: QueueEntryStatus): {
  canCall: boolean;
  canSkip: boolean;
  canCancel: boolean;
  canNoShow: boolean;
  canSeat: boolean;
  canComplete: boolean;
} {
  return {
    canCall: canTransitionQueueStatus(status, "CALLED") && status !== "CALLED",
    canSkip:
      canTransitionQueueStatus(status, "SKIPPED") && status !== "SKIPPED",
    canCancel:
      canTransitionQueueStatus(status, "CANCELLED") && status !== "CANCELLED",
    canNoShow:
      canTransitionQueueStatus(status, "NO_SHOW") && status !== "NO_SHOW",
    canSeat: canTransitionQueueStatus(status, "SEATED") && status !== "SEATED",
    canComplete:
      canTransitionQueueStatus(status, "COMPLETED") && status !== "COMPLETED",
  };
}
