import { PUBLIC_QUEUE_SENSITIVE_KEYS } from "@/lib/public-queue/types";
import type {
  RealtimeChange,
  RealtimeChangeSource,
} from "@/lib/realtime/types";

const SENSITIVE_KEY_SET = new Set(
  PUBLIC_QUEUE_SENSITIVE_KEYS.map((key) =>
    key.toLowerCase().replace(/[_-]/g, ""),
  ),
);

const REALTIME_SOURCES = new Set<RealtimeChangeSource>([
  "queue_entries",
  "queue_events",
  "queues",
  "restaurant_tables",
  "broadcast",
]);

type PostgresPayload = {
  eventType?: unknown;
  table?: unknown;
  new?: unknown;
  old?: unknown;
  payload?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

export function payloadContainsSensitiveKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => payloadContainsSensitiveKeys(item));
  }
  if (!isRecord(value)) return false;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_SET.has(normalizeKey(key))) {
      return true;
    }
    if (payloadContainsSensitiveKeys(nested)) {
      return true;
    }
  }
  return false;
}

function readString(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function rowFromPayload(
  payload: PostgresPayload,
): Record<string, unknown> | null {
  if (isRecord(payload.new)) return payload.new;
  if (isRecord(payload.old)) return payload.old;
  if (isRecord(payload.payload) && isRecord(payload.payload.new)) {
    return payload.payload.new;
  }
  if (isRecord(payload.payload) && isRecord(payload.payload.old)) {
    return payload.payload.old;
  }
  if (isRecord(payload.payload)) return payload.payload;
  return null;
}

function asSource(value: unknown): RealtimeChangeSource | null {
  if (typeof value !== "string") return null;
  if (REALTIME_SOURCES.has(value as RealtimeChangeSource)) {
    return value as RealtimeChangeSource;
  }
  return null;
}

function asEventType(value: unknown): RealtimeChange["eventType"] {
  if (
    value === "INSERT" ||
    value === "UPDATE" ||
    value === "DELETE" ||
    value === "queue_changed" ||
    value === "*"
  ) {
    return value;
  }
  return "*";
}

/**
 * Strip postgres_changes / broadcast payloads down to identifiers.
 * Never pass names, phones, emails, or access tokens through to UI state.
 */
export function toRealtimeChange(
  payload: unknown,
  fallbackSource?: RealtimeChangeSource,
): RealtimeChange | null {
  if (!isRecord(payload)) {
    if (!fallbackSource) return null;
    return {
      source: fallbackSource,
      eventType: "*",
      recordId: null,
      queueId: null,
      branchId: null,
      queueEntryId: null,
    };
  }

  const typed = payload as PostgresPayload;
  const row = rowFromPayload(typed);
  const source =
    asSource(typed.table) ?? asSource(row?.source) ?? fallbackSource;
  if (!source) return null;

  return {
    source,
    eventType: asEventType(typed.eventType ?? row?.event ?? row?.type),
    recordId: readString(row, "id", "record_id", "recordId"),
    queueId: readString(row, "queue_id", "queueId"),
    branchId: readString(row, "branch_id", "branchId"),
    queueEntryId: readString(row, "queue_entry_id", "queueEntryId"),
  };
}

export function realtimeChangeKey(change: RealtimeChange): string {
  return [
    change.source,
    change.eventType,
    change.recordId ?? "",
    change.queueId ?? "",
    change.queueEntryId ?? "",
  ].join(":");
}

export function createRealtimeEventDedupe(windowMs = 1500) {
  const seen = new Map<string, number>();

  return function accept(change: RealtimeChange): boolean {
    const key = realtimeChangeKey(change);
    const now = Date.now();
    const previous = seen.get(key);
    if (previous != null && now - previous < windowMs) {
      return false;
    }
    seen.set(key, now);
    if (seen.size > 200) {
      for (const [entry, timestamp] of seen) {
        if (now - timestamp > windowMs) {
          seen.delete(entry);
        }
      }
    }
    return true;
  };
}

export function shouldRefreshQueueForChange(
  change: RealtimeChange,
  scope: { queueId: string; branchId: string },
): boolean {
  if (change.source === "broadcast") return true;
  if (change.source === "queues" || change.source === "queue_entries") {
    return !change.queueId || change.queueId === scope.queueId;
  }
  if (change.source === "queue_events") {
    return true;
  }
  if (change.source === "restaurant_tables") {
    return !change.branchId || change.branchId === scope.branchId;
  }
  return false;
}

export function shouldRefreshTablesForChange(
  change: RealtimeChange,
  scope: { branchId: string },
): boolean {
  if (change.source !== "restaurant_tables") return false;
  return !change.branchId || change.branchId === scope.branchId;
}

export function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }
  const copy = items.slice();
  copy[index] = next;
  return copy;
}

export { payloadContainsSensitiveKeys as realtimePayloadHasPii };
