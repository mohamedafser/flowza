import { sortWaitingEntries } from "@/lib/utils/queue";
import type { QueueEntryStatus } from "@/lib/validations/queue";

export type WaitEstimateEntry = {
  id: string;
  status: QueueEntryStatus;
  joined_at: string;
  party_size: number;
};

export type WaitEstimateInput = {
  entries: readonly WaitEstimateEntry[];
  entryId: string;
  estimatedServiceMinutes: number;
};

export type WaitEstimate = {
  position: number | null;
  partiesAhead: number;
  estimatedWaitMinutes: number | null;
};

function servingCount(entries: readonly WaitEstimateEntry[]): number {
  return entries.filter(
    (entry) => entry.status === "CALLED" || entry.status === "SEATED",
  ).length;
}

/**
 * Deterministic wait estimate for a waiting party.
 * Wait = (parties ahead in line + currently serving) × service duration.
 * Position is 1-based among WAITING entries only.
 */
export function estimateWaitTime(input: WaitEstimateInput): WaitEstimate {
  const duration = Math.max(0, input.estimatedServiceMinutes);
  const waiting = sortWaitingEntries(
    input.entries.filter((entry) => entry.status === "WAITING"),
  );
  const index = waiting.findIndex((entry) => entry.id === input.entryId);

  if (index < 0) {
    return {
      position: null,
      partiesAhead: 0,
      estimatedWaitMinutes: null,
    };
  }

  const partiesAhead = index;
  const serving = servingCount(input.entries);
  return {
    position: index + 1,
    partiesAhead,
    estimatedWaitMinutes: (partiesAhead + serving) * duration,
  };
}

export function estimateWaitMinutesForPosition(input: {
  position: number;
  servingCount: number;
  estimatedServiceMinutes: number;
}): number {
  const partiesAhead = Math.max(0, input.position - 1);
  return (
    (partiesAhead + Math.max(0, input.servingCount)) *
    Math.max(0, input.estimatedServiceMinutes)
  );
}
