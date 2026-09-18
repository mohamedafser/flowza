export const REALTIME_CONNECTION_STATUSES = [
  "connecting",
  "connected",
  "reconnecting",
  "disconnected",
  "error",
] as const;

export type RealtimeConnectionStatus =
  (typeof REALTIME_CONNECTION_STATUSES)[number];

export const REALTIME_QUEUE_TABLES = [
  "queue_entries",
  "queue_events",
  "queues",
] as const;

export type RealtimeQueueTable = (typeof REALTIME_QUEUE_TABLES)[number];

export const REALTIME_TABLE_TABLES = ["restaurant_tables"] as const;

export type RealtimeTableTable = (typeof REALTIME_TABLE_TABLES)[number];

export type RealtimeChangeSource =
  RealtimeQueueTable | RealtimeTableTable | "broadcast";

export type RealtimeChange = {
  source: RealtimeChangeSource;
  eventType: "INSERT" | "UPDATE" | "DELETE" | "queue_changed" | "*";
  recordId: string | null;
  queueId: string | null;
  branchId: string | null;
  queueEntryId: string | null;
};

export const REALTIME_QUEUE_CHANGED_EVENT = "queue_changed";

export const REALTIME_REFRESH_DEBOUNCE_MS = 200;

export const PUBLIC_QUEUE_REALTIME_FALLBACK_MS = 30_000;
