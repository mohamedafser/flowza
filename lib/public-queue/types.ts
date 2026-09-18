import type { QueueEntryStatus, QueueStatus } from "@/lib/validations/queue";

export const PUBLIC_QUEUE_AVAILABILITY_REASONS = [
  "ok",
  "paused",
  "closed",
  "full",
  "outside_hours",
  "disabled",
  "unavailable",
] as const;

export type PublicQueueAvailabilityReason =
  (typeof PUBLIC_QUEUE_AVAILABILITY_REASONS)[number];

export type PublicQueueBrand = {
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type PublicQueueBranch = {
  name: string;
  slug: string;
  address: string | null;
};

export type PublicQueueSummary = {
  name: string;
  slug: string;
  status: QueueStatus;
};

export type PublicQueueCustomerSettings = {
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  showEstimatedWait: boolean;
  showQueuePosition: boolean;
  showPartySize: boolean;
  allowCustomerCancel: boolean;
  allowSelfCheckIn: boolean;
  maxPartySize: number;
};

export type PublicQueueAvailability = {
  canJoin: boolean;
  reason: PublicQueueAvailabilityReason;
  message: string;
  isOpen: boolean;
};

export type PublicQueueInfo = {
  restaurant: PublicQueueBrand;
  branch: PublicQueueBranch;
  queue: PublicQueueSummary | null;
  availability: PublicQueueAvailability;
  waitingCount: number;
  nowServingToken: string | null;
  estimatedWaitMinutes: number | null;
  settings: PublicQueueCustomerSettings;
  timezone: string;
};

export type PublicQueueEntryStatus = {
  token: string;
  status: QueueEntryStatus;
  partySize: number;
  position: number | null;
  partiesAhead: number | null;
  estimatedWaitMinutes: number | null;
  nowServingToken: string | null;
  tableLabel: string | null;
  canCancel: boolean;
};

export type PublicQueueStatusResponse = {
  restaurant: PublicQueueBrand;
  branch: PublicQueueBranch;
  queue: PublicQueueSummary;
  entry: PublicQueueEntryStatus;
  settings: PublicQueueCustomerSettings;
  timezone: string;
  realtimeChannel: string | null;
};

export type PublicQueueJoinResponse = {
  accessToken: string;
  statusPath: string;
  reused: boolean;
  status: PublicQueueStatusResponse;
};

export const PUBLIC_QUEUE_SENSITIVE_KEYS = [
  "phone",
  "email",
  "customer_id",
  "customerid",
  "userid",
  "user_id",
  "created_by",
  "createdby",
  "membership",
  "role",
  "staff",
  "authorization",
  "password",
  "public_access_token",
  "publicaccesstoken",
] as const;
