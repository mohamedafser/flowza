const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const QUEUE_CHANNEL_PATTERN = new RegExp(
  `^restaurant:${UUID_PATTERN}:queue:${UUID_PATTERN}$`,
  "i",
);

export const TABLE_CHANNEL_PATTERN = new RegExp(
  `^restaurant:${UUID_PATTERN}:branch:${UUID_PATTERN}:tables$`,
  "i",
);

const FORBIDDEN_CHANNEL_PATTERNS = [
  /phone/i,
  /email/i,
  /token/i,
  /customer/i,
  /@/,
];

export function createQueueChannel(
  restaurantId: string,
  queueId: string,
): string {
  return `restaurant:${restaurantId}:queue:${queueId}`;
}

export function createTableChannel(
  restaurantId: string,
  branchId: string,
): string {
  return `restaurant:${restaurantId}:branch:${branchId}:tables`;
}

export function parseQueueChannel(
  channel: string,
): { restaurantId: string; queueId: string } | null {
  const match = channel.trim().match(QUEUE_CHANNEL_PATTERN);
  if (!match) return null;
  const parts = channel.split(":");
  const restaurantId = parts[1];
  const queueId = parts[3];
  if (!restaurantId || !queueId) return null;
  return { restaurantId, queueId };
}

export function parseTableChannel(
  channel: string,
): { restaurantId: string; branchId: string } | null {
  const match = channel.trim().match(TABLE_CHANNEL_PATTERN);
  if (!match) return null;
  const parts = channel.split(":");
  const restaurantId = parts[1];
  const branchId = parts[3];
  if (!restaurantId || !branchId) return null;
  return { restaurantId, branchId };
}

export function isSafeRealtimeChannel(channel: string): boolean {
  const value = channel.trim();
  if (!value) return false;
  if (FORBIDDEN_CHANNEL_PATTERNS.some((pattern) => pattern.test(value))) {
    return false;
  }
  return QUEUE_CHANNEL_PATTERN.test(value) || TABLE_CHANNEL_PATTERN.test(value);
}

export function assertSafeRealtimeChannel(channel: string): string {
  const value = channel.trim();
  if (!isSafeRealtimeChannel(value)) {
    throw new Error("Invalid realtime channel.");
  }
  return value;
}
