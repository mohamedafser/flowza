import { isOpenAt, type ResolvedHours } from "@/lib/utils/hours";
import { normalizeTime } from "@/lib/utils/datetime";
import {
  ACTIVE_RESERVATION_STATUSES,
  DEFAULT_DURATION_MINUTES,
  type ReservationStatus,
} from "@/lib/validations/reservation";

export type ReservationSlot = {
  reservationDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
  tableId?: string | null;
  excludeReservationId?: string | null;
};

export type ExistingReservationSlot = {
  id: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  partySize: number;
  tableId: string | null;
  status: ReservationStatus;
};

export type TableCandidate = {
  id: string;
  capacity: number;
  status: string;
  branchId: string;
};

export type AvailabilityIssue =
  | "OUTSIDE_HOURS"
  | "CLOSED"
  | "IN_PAST"
  | "PARTY_TOO_LARGE"
  | "TABLE_CAPACITY"
  | "TABLE_BLOCKED"
  | "TABLE_UNAVAILABLE"
  | "TABLE_CONFLICT"
  | "BRANCH_MISMATCH";

export type AvailabilityResult = {
  ok: boolean;
  issues: AvailabilityIssue[];
  suggestedTableIds: string[];
};

export function normalizeReservationTime(value: string): string {
  const normalized = normalizeTime(value);
  if (!normalized) return value.slice(0, 5);
  return normalized;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const normalized = normalizeReservationTime(time);
  const [hoursText, minutesText] = normalized.split(":");
  const total = Number(hoursText) * 60 + Number(minutesText) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function resolveEndTime(
  startTime: string,
  durationMinutes: number,
  endTime?: string | null,
): string {
  if (endTime) {
    return normalizeReservationTime(endTime);
  }
  return addMinutesToTime(
    startTime,
    durationMinutes > 0 ? durationMinutes : DEFAULT_DURATION_MINUTES,
  );
}

export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = normalizeReservationTime(startA);
  const aEnd = normalizeReservationTime(endA);
  const bStart = normalizeReservationTime(startB);
  const bEnd = normalizeReservationTime(endB);
  return aStart < bEnd && bStart < aEnd;
}

export function isActiveReservationStatus(
  status: ReservationStatus,
): boolean {
  return (ACTIVE_RESERVATION_STATUSES as readonly string[]).includes(status);
}

export function compareDateTimeInZone(input: {
  date: string;
  time: string;
  timezone: string;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const time = normalizeReservationTime(input.time);
  const candidate = zonedInstant(input.date, time, input.timezone);
  return candidate.getTime() - now.getTime();
}

/**
 * Approximate instant for a local date+time in an IANA zone.
 * Good enough for past-check and open-at validation.
 */
export function zonedInstant(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const normalizedTime = normalizeReservationTime(time);
  const isoLocal = `${date}T${normalizedTime}:00`;
  const asUtc = new Date(`${isoLocal}Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(asUtc);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const asLocal = Date.UTC(
    Number(read("year")),
    Number(read("month")) - 1,
    Number(read("day")),
    Number(read("hour")),
    Number(read("minute")),
    Number(read("second")),
  );
  const offset = asLocal - asUtc.getTime();
  return new Date(asUtc.getTime() - offset);
}

export function checkOperatingHours(
  resolved: ResolvedHours,
  time: string,
): AvailabilityIssue | null {
  if (resolved.isClosed || resolved.source === "none") {
    return "CLOSED";
  }
  if (!isOpenAt(resolved, normalizeReservationTime(time))) {
    return "OUTSIDE_HOURS";
  }
  return null;
}

export function findConflictingReservations(
  existing: readonly ExistingReservationSlot[],
  slot: ReservationSlot,
): ExistingReservationSlot[] {
  const end = resolveEndTime(
    slot.startTime,
    DEFAULT_DURATION_MINUTES,
    slot.endTime,
  );
  return existing.filter((row) => {
    if (slot.excludeReservationId && row.id === slot.excludeReservationId) {
      return false;
    }
    if (!isActiveReservationStatus(row.status)) {
      return false;
    }
    if (slot.tableId) {
      if (!row.tableId || row.tableId !== slot.tableId) {
        return false;
      }
    }
    const rowEnd = resolveEndTime(
      row.startTime,
      row.durationMinutes,
      row.endTime,
    );
    return timesOverlap(slot.startTime, end, row.startTime, rowEnd);
  });
}

export function suggestTablesForParty(
  tables: readonly TableCandidate[],
  partySize: number,
  branchId: string,
  conflictingTableIds: ReadonlySet<string>,
): string[] {
  return tables
    .filter((table) => {
      if (table.branchId !== branchId) return false;
      if (table.capacity < partySize) return false;
      if (table.status === "BLOCKED") return false;
      if (table.status === "OCCUPIED") return false;
      if (conflictingTableIds.has(table.id)) return false;
      return table.status === "AVAILABLE" || table.status === "RESERVED";
    })
    .sort((left, right) => {
      const capacityDelta =
        left.capacity - partySize - (right.capacity - partySize);
      if (capacityDelta !== 0) return capacityDelta;
      return left.capacity - right.capacity;
    })
    .map((table) => table.id);
}

export function evaluateAvailability(input: {
  resolvedHours: ResolvedHours;
  timezone: string;
  branchId: string;
  slot: ReservationSlot;
  existing: readonly ExistingReservationSlot[];
  tables: readonly TableCandidate[];
  maxPartySize?: number;
  now?: Date;
}): AvailabilityResult {
  const issues: AvailabilityIssue[] = [];
  const time = normalizeReservationTime(input.slot.startTime);
  const end = resolveEndTime(
    time,
    DEFAULT_DURATION_MINUTES,
    input.slot.endTime,
  );

  const hoursIssue = checkOperatingHours(input.resolvedHours, time);
  if (hoursIssue) {
    issues.push(hoursIssue);
  }

  if (
    compareDateTimeInZone({
      date: input.slot.reservationDate,
      time,
      timezone: input.timezone,
      now: input.now,
    }) < 0
  ) {
    issues.push("IN_PAST");
  }

  if (
    input.maxPartySize != null &&
    input.slot.partySize > input.maxPartySize
  ) {
    issues.push("PARTY_TOO_LARGE");
  }

  const conflicts = findConflictingReservations(input.existing, {
    ...input.slot,
    startTime: time,
    endTime: end,
  });
  const conflictingTableIds = new Set(
    conflicts
      .map((row) => row.tableId)
      .filter((id): id is string => typeof id === "string"),
  );

  if (input.slot.tableId) {
    const table = input.tables.find((item) => item.id === input.slot.tableId);
    if (!table || table.branchId !== input.branchId) {
      issues.push("BRANCH_MISMATCH");
    } else {
      if (table.capacity < input.slot.partySize) {
        issues.push("TABLE_CAPACITY");
      }
      if (table.status === "BLOCKED") {
        issues.push("TABLE_BLOCKED");
      }
      if (table.status === "OCCUPIED") {
        issues.push("TABLE_UNAVAILABLE");
      }
      if (conflictingTableIds.has(table.id)) {
        issues.push("TABLE_CONFLICT");
      }
    }
  }

  const suggestedTableIds = suggestTablesForParty(
    input.tables,
    input.slot.partySize,
    input.branchId,
    conflictingTableIds,
  );

  return {
    ok: issues.length === 0,
    issues,
    suggestedTableIds,
  };
}

export function availabilityMessage(issues: AvailabilityIssue[]): string {
  if (issues.includes("CLOSED")) {
    return "The branch is closed on this date.";
  }
  if (issues.includes("OUTSIDE_HOURS")) {
    return "That time is outside operating hours.";
  }
  if (issues.includes("IN_PAST")) {
    return "Reservation cannot be in the past.";
  }
  if (issues.includes("TABLE_CONFLICT")) {
    return "That table is already reserved for this time.";
  }
  if (issues.includes("TABLE_CAPACITY")) {
    return "Selected table cannot seat this party size.";
  }
  if (issues.includes("TABLE_BLOCKED") || issues.includes("TABLE_UNAVAILABLE")) {
    return "Selected table is not available.";
  }
  if (issues.includes("PARTY_TOO_LARGE")) {
    return "Party size exceeds the restaurant limit.";
  }
  if (issues.includes("BRANCH_MISMATCH")) {
    return "Selected table does not belong to this branch.";
  }
  return "Reservation is not available.";
}
