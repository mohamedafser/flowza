import type { QueueEntryStatus } from "@/lib/validations/queue";
import type { PublicQueueAvailabilityReason } from "@/lib/public-queue/types";

export const PUBLIC_QUEUE_MESSAGES = {
  paused: "Queue is temporarily paused. Please try again shortly.",
  closed: "Queue is currently closed.",
  full: "Queue is currently full. Please try again later.",
  outsideHours: "This location is currently closed.",
  disabled: "Unable to join the queue right now.",
  unavailable: "Queue not found.",
  notFound: "Queue not found.",
  branchNotFound: "Branch not found.",
  invalidToken: "This queue link is invalid.",
  alreadyCancelled: "Queue entry cancelled.",
  cancelDisabled: "Cancellation is not available.",
  invalidCancel: "This queue entry can no longer be cancelled.",
  unableToJoin: "Unable to join the queue. Please try again.",
  network: "Network error. Check your connection and try again.",
  unexpected: "Something went wrong. Please try again.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
} as const;

export const PUBLIC_QUEUE_STATUS_COPY: Record<
  QueueEntryStatus,
  { title: string; description: string }
> = {
  WAITING: {
    title: "You're in the queue",
    description:
      "Please stay nearby. We will update this page as your turn approaches.",
  },
  CALLED: {
    title: "It's your turn!",
    description: "Please proceed to the restaurant/staff.",
  },
  SEATED: {
    title: "You're seated",
    description: "Enjoy your visit. This queue entry is complete for waiting.",
  },
  COMPLETED: {
    title: "Visit completed",
    description: "Thanks for dining with us.",
  },
  SKIPPED: {
    title: "Your queue entry was skipped.",
    description: "Please contact restaurant staff if needed.",
  },
  CANCELLED: {
    title: "Queue entry cancelled.",
    description: "This place in line is no longer active.",
  },
  NO_SHOW: {
    title: "Queue entry marked as no-show.",
    description: "Please contact restaurant staff if you still need a table.",
  },
};

export function availabilityMessage(
  reason: PublicQueueAvailabilityReason,
): string {
  switch (reason) {
    case "ok":
      return "This queue is accepting guests.";
    case "paused":
      return PUBLIC_QUEUE_MESSAGES.paused;
    case "closed":
      return PUBLIC_QUEUE_MESSAGES.closed;
    case "full":
      return PUBLIC_QUEUE_MESSAGES.full;
    case "outside_hours":
      return PUBLIC_QUEUE_MESSAGES.outsideHours;
    case "disabled":
      return PUBLIC_QUEUE_MESSAGES.disabled;
    default:
      return PUBLIC_QUEUE_MESSAGES.unavailable;
  }
}

export const PUBLIC_QUEUE_STATUS_POLLABLE: ReadonlySet<QueueEntryStatus> =
  new Set(["WAITING", "CALLED"]);
