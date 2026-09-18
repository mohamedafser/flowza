import { hasPermission } from "@/lib/auth/permissions";
import { roleAtLeast, type MemberRole } from "@/lib/auth/roles";
import { tableDisplayName } from "@/lib/utils/tables";
import type { StatusTone } from "@/types";
import {
  QUEUE_ENTRY_STATUS_LABELS,
  QUEUE_STATUS_LABELS,
  type QueueEntryStatus,
  type QueueStatus,
} from "@/lib/validations/queue";

export type QueueRecord = {
  id: string;
  branch_id: string;
  name: string;
  status: QueueStatus;
  prefix: string;
  current_number: number;
  starting_number: number;
  estimated_service_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type QueueCustomerSummary = {
  id: string;
  name: string;
};

export type QueueTableSummary = {
  id: string;
  table_number: string;
  name: string | null;
  capacity: number;
  status: string;
  branch_id: string;
};

export type QueueEntryRecord = {
  id: string;
  queue_id: string;
  customer_id: string | null;
  table_id: string | null;
  token: string;
  business_date: string;
  party_size: number;
  status: QueueEntryStatus;
  joined_at: string;
  called_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  skipped_at: string | null;
  no_show_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QueueEntryWithRelations = QueueEntryRecord & {
  customer: QueueCustomerSummary | null;
  table: QueueTableSummary | null;
};

export type QueueStats = {
  waiting: number;
  called: number;
  seated: number;
  completed: number;
  skipped: number;
  cancelled: number;
  noShow: number;
};

export type QueueScopeCheck = {
  membershipRestaurantId: string | null;
  queueRestaurantId: string;
  currentRestaurantId: string;
  queueBranchId: string;
  expectedBranchId: string;
  entryQueueId?: string;
  expectedQueueId?: string;
  customerRestaurantId?: string | null;
  tableBranchId?: string | null;
};

export type QueueScopeFailure =
  "restaurant" | "branch" | "queue" | "customer" | "table";

export function canViewQueue(role: MemberRole): boolean {
  return hasPermission(role, "queue.view");
}

export function canManageQueue(role: MemberRole): boolean {
  return hasPermission(role, "queue.manage");
}

/** Create/update queue configuration (name, prefix, duration). */
export function canConfigureQueue(role: MemberRole): boolean {
  return hasPermission(role, "queue.manage") && roleAtLeast(role, "MANAGER");
}

export function queueStatusLabel(status: QueueStatus): string {
  return QUEUE_STATUS_LABELS[status];
}

export function queueEntryStatusLabel(status: QueueEntryStatus): string {
  return QUEUE_ENTRY_STATUS_LABELS[status];
}

export function queueStatusTone(status: QueueStatus): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PAUSED":
      return "warning";
    case "CLOSED":
      return "danger";
  }
}

export function queueEntryStatusTone(status: QueueEntryStatus): StatusTone {
  switch (status) {
    case "WAITING":
      return "info";
    case "CALLED":
      return "warning";
    case "SEATED":
      return "success";
    case "COMPLETED":
      return "success";
    case "SKIPPED":
      return "default";
    case "CANCELLED":
      return "danger";
    case "NO_SHOW":
      return "danger";
  }
}

export function compareQueueOrder(
  a: Pick<QueueEntryRecord, "joined_at" | "id"> & { token?: string },
  b: Pick<QueueEntryRecord, "joined_at" | "id"> & { token?: string },
): number {
  const byJoined = a.joined_at.localeCompare(b.joined_at);
  if (byJoined !== 0) return byJoined;
  const byToken = (a.token ?? "").localeCompare(b.token ?? "");
  if (byToken !== 0) return byToken;
  return a.id.localeCompare(b.id);
}

export function sortWaitingEntries<
  T extends Pick<QueueEntryRecord, "status" | "joined_at" | "id"> & {
    token?: string;
  },
>(entries: readonly T[]): T[] {
  return entries
    .filter((entry) => entry.status === "WAITING")
    .slice()
    .sort(compareQueueOrder);
}

export function deriveQueueStatistics(
  entries: readonly Pick<QueueEntryRecord, "status">[],
): QueueStats {
  const stats: QueueStats = {
    waiting: 0,
    called: 0,
    seated: 0,
    completed: 0,
    skipped: 0,
    cancelled: 0,
    noShow: 0,
  };

  for (const entry of entries) {
    switch (entry.status) {
      case "WAITING":
        stats.waiting += 1;
        break;
      case "CALLED":
        stats.called += 1;
        break;
      case "SEATED":
        stats.seated += 1;
        break;
      case "COMPLETED":
        stats.completed += 1;
        break;
      case "SKIPPED":
        stats.skipped += 1;
        break;
      case "CANCELLED":
        stats.cancelled += 1;
        break;
      case "NO_SHOW":
        stats.noShow += 1;
        break;
    }
  }

  return stats;
}

export function isHistoryEntry(status: QueueEntryStatus): boolean {
  return (
    status === "COMPLETED" ||
    status === "SKIPPED" ||
    status === "CANCELLED" ||
    status === "NO_SHOW"
  );
}

export function currentlyServingEntries<T extends QueueEntryRecord>(
  entries: readonly T[],
): T[] {
  return entries
    .filter((entry) => entry.status === "CALLED" || entry.status === "SEATED")
    .slice()
    .sort((a, b) => {
      const aTime = a.called_at ?? a.joined_at;
      const bTime = b.called_at ?? b.joined_at;
      return bTime.localeCompare(aTime);
    });
}

export function suitableTablesForParty<
  T extends {
    status: string;
    capacity: number;
    table_number: string;
    sort_order?: number;
    id: string;
  },
>(tables: readonly T[], partySize: number): T[] {
  return tables
    .filter(
      (table) => table.status === "AVAILABLE" && table.capacity >= partySize,
    )
    .slice()
    .sort((a, b) => {
      const byCapacity = a.capacity - b.capacity;
      if (byCapacity !== 0) return byCapacity;
      const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (byOrder !== 0) return byOrder;
      const byNumber = a.table_number.localeCompare(b.table_number, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byNumber !== 0) return byNumber;
      return a.id.localeCompare(b.id);
    });
}

export function queueTableLabel(
  table: Pick<QueueTableSummary, "table_number" | "name"> | null,
): string | null {
  if (!table) return null;
  return tableDisplayName(table);
}

export function authorizeQueueScope(
  input: QueueScopeCheck,
): { ok: true } | { ok: false; reason: QueueScopeFailure } {
  if (
    !input.membershipRestaurantId ||
    input.membershipRestaurantId !== input.queueRestaurantId ||
    input.currentRestaurantId !== input.queueRestaurantId
  ) {
    return { ok: false, reason: "restaurant" };
  }

  if (input.queueBranchId !== input.expectedBranchId) {
    return { ok: false, reason: "branch" };
  }

  if (
    input.entryQueueId &&
    input.expectedQueueId &&
    input.entryQueueId !== input.expectedQueueId
  ) {
    return { ok: false, reason: "queue" };
  }

  if (
    input.customerRestaurantId &&
    input.customerRestaurantId !== input.queueRestaurantId
  ) {
    return { ok: false, reason: "customer" };
  }

  if (input.tableBranchId && input.tableBranchId !== input.expectedBranchId) {
    return { ok: false, reason: "table" };
  }

  return { ok: true };
}

export function formatWaitMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes <= 0) return "Now";
  if (minutes === 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) {
    return hours === 1 ? "1 hr" : `${hours} hr`;
  }
  return `${hours}h ${rest}m`;
}

export function elapsedMinutesSince(
  iso: string | null,
  now: Date,
): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 60000));
}

export function pickQueue(
  queues: readonly QueueRecord[],
  preferredId?: string | null,
): QueueRecord | null {
  if (queues.length === 0) {
    return null;
  }
  if (preferredId) {
    const match = queues.find((queue) => queue.id === preferredId);
    if (match) return match;
  }
  if (queues.length === 1) {
    return queues[0] ?? null;
  }
  return queues.find((queue) => queue.status === "ACTIVE") ?? queues[0] ?? null;
}
