import {
  buildPeakHours,
  buildQueueAnalyticsSummary,
  buildQueueVolumeSeries,
  buildServiceTrend,
  buildWaitTrend,
  serviceDurations,
  waitDurations,
  type QueueAnalyticsRow,
} from "@/lib/analytics/aggregations";
import type { DashboardDateRange } from "@/lib/analytics/date-range";
import { summarizeDurations } from "@/lib/analytics/metrics";
import type {
  QueueAnalyticsSummary,
  ServiceTimeAnalytics,
  WaitTimeAnalytics,
} from "@/lib/analytics/types";
import { createClient } from "@/lib/supabase/server";
import type { PeakHourRow, VolumePoint } from "@/lib/analytics/metrics";
import type { QueueEntryStatus } from "@/lib/validations/queue";

const QUEUE_ANALYTICS_SELECT =
  "id, customer_id, reservation_id, party_size, status, business_date, joined_at, called_at, seated_at, completed_at";

export async function fetchQueueAnalyticsRows(input: {
  branchId: string;
  range: DashboardDateRange;
}): Promise<QueueAnalyticsRow[]> {
  const supabase = await createClient();
  const { data: queues, error: queueError } = await supabase
    .from("queues")
    .select("id")
    .eq("branch_id", input.branchId);

  if (queueError) {
    throw new Error("Unable to load queues for analytics.");
  }

  const queueIds = (queues ?? []).map((queue) => queue.id);
  if (queueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("queue_entries")
    .select(QUEUE_ANALYTICS_SELECT)
    .in("queue_id", queueIds)
    .gte("business_date", input.range.startDate)
    .lte("business_date", input.range.endDate)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load queue analytics.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    reservation_id: row.reservation_id,
    party_size: row.party_size,
    status: row.status as QueueEntryStatus,
    business_date: row.business_date,
    joined_at: row.joined_at,
    called_at: row.called_at,
    seated_at: row.seated_at,
    completed_at: row.completed_at,
  }));
}

export async function fetchLiveQueueCounts(input: {
  branchId: string;
  businessDate: string;
}): Promise<{
  waiting: number;
  serving: number;
  servedToday: number;
  queueId: string | null;
  estimatedServiceMinutes: number | null;
}> {
  const supabase = await createClient();
  const { data: queues } = await supabase
    .from("queues")
    .select("id, estimated_service_minutes, created_at")
    .eq("branch_id", input.branchId)
    .order("created_at", { ascending: true });

  const queueIds = (queues ?? []).map((queue) => queue.id);
  const primary = queues?.[0] ?? null;
  if (queueIds.length === 0) {
    return {
      waiting: 0,
      serving: 0,
      servedToday: 0,
      queueId: null,
      estimatedServiceMinutes: null,
    };
  }

  const { data } = await supabase
    .from("queue_entries")
    .select("status")
    .in("queue_id", queueIds)
    .eq("business_date", input.businessDate);

  let waiting = 0;
  let serving = 0;
  let servedToday = 0;
  for (const row of data ?? []) {
    if (row.status === "WAITING") waiting += 1;
    if (row.status === "CALLED" || row.status === "SEATED") serving += 1;
    if (row.status === "COMPLETED") servedToday += 1;
  }

  return {
    waiting,
    serving,
    servedToday,
    queueId: primary?.id ?? null,
    estimatedServiceMinutes: primary?.estimated_service_minutes ?? null,
  };
}

export function getQueueAnalytics(
  rows: readonly QueueAnalyticsRow[],
): QueueAnalyticsSummary {
  return buildQueueAnalyticsSummary(rows);
}

export function getWaitTimeAnalytics(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): WaitTimeAnalytics {
  const stats = summarizeDurations(waitDurations(rows));
  return {
    ...stats,
    trend: buildWaitTrend(rows, range).map((point) => ({
      ...point,
      count: point.averageWaitMinutes === null ? 0 : Math.round(point.averageWaitMinutes),
    })),
  };
}

export function getServiceTimeAnalytics(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): ServiceTimeAnalytics {
  const stats = summarizeDurations(serviceDurations(rows));
  return {
    ...stats,
    trend: buildServiceTrend(rows, range).map((point) => ({
      ...point,
      count:
        point.averageWaitMinutes === null
          ? 0
          : Math.round(point.averageWaitMinutes),
    })),
  };
}

export function getPeakHours(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): PeakHourRow[] {
  return buildPeakHours(rows, range);
}

export function getQueueVolume(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): VolumePoint[] {
  return buildQueueVolumeSeries(rows, range);
}
