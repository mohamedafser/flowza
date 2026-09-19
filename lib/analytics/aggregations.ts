import {
  formatHourRangeLabel,
  hourLabels,
  listDatesInRange,
  type DashboardDateGrouping,
  type DashboardDateRange,
} from "@/lib/analytics/date-range";
import {
  average,
  buildPartySizeDistribution,
  computeRate,
  durationMinutes,
  summarizeDurations,
  type PeakHourRow,
  type VolumePoint,
} from "@/lib/analytics/metrics";
import { getZonedDateParts } from "@/lib/utils/datetime";
import type { QueueEntryStatus } from "@/lib/validations/queue";
import type { ReservationStatus } from "@/lib/validations/reservation";

export type QueueAnalyticsRow = {
  id: string;
  customer_id: string | null;
  reservation_id: string | null;
  party_size: number;
  status: QueueEntryStatus;
  business_date: string;
  joined_at: string;
  called_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
};

export type ReservationAnalyticsRow = {
  id: string;
  customer_id: string | null;
  party_size: number;
  status: ReservationStatus;
  reservation_date: string;
  start_time: string;
};

export function summarizeQueueStatuses(rows: readonly QueueAnalyticsRow[]) {
  const summary = {
    total: rows.length,
    waiting: 0,
    called: 0,
    seated: 0,
    completed: 0,
    skipped: 0,
    cancelled: 0,
    noShow: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case "WAITING":
        summary.waiting += 1;
        break;
      case "CALLED":
        summary.called += 1;
        break;
      case "SEATED":
        summary.seated += 1;
        break;
      case "COMPLETED":
        summary.completed += 1;
        break;
      case "SKIPPED":
        summary.skipped += 1;
        break;
      case "CANCELLED":
        summary.cancelled += 1;
        break;
      case "NO_SHOW":
        summary.noShow += 1;
        break;
    }
  }

  return summary;
}

export function waitDurations(rows: readonly QueueAnalyticsRow[]): number[] {
  const values: number[] = [];
  for (const row of rows) {
    const minutes = durationMinutes(row.joined_at, row.called_at);
    if (minutes !== null) values.push(minutes);
  }
  return values;
}

export function serviceDurations(rows: readonly QueueAnalyticsRow[]): number[] {
  const values: number[] = [];
  for (const row of rows) {
    const minutes = durationMinutes(row.called_at, row.completed_at);
    if (minutes !== null) values.push(minutes);
  }
  return values;
}

function emptyVolumeKeys(
  range: DashboardDateRange,
): { key: string; label: string }[] {
  if (range.grouping === "hour") {
    return hourLabels().map((label) => ({ key: label, label }));
  }
  return listDatesInRange(range.startDate, range.endDate).map((date) => ({
    key: date,
    label: date,
  }));
}

function volumeKeyForInstant(
  iso: string,
  range: DashboardDateRange,
  grouping: DashboardDateGrouping,
): string | null {
  const parts = getZonedDateParts(new Date(iso), range.timezone);
  if (parts.date < range.startDate || parts.date > range.endDate) {
    return null;
  }
  if (grouping === "hour") {
    return `${String(parts.hour).padStart(2, "0")}:00`;
  }
  return parts.date;
}

export function buildQueueVolumeSeries(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): VolumePoint[] {
  const buckets = new Map<string, { count: number; waits: number[] }>();
  for (const slot of emptyVolumeKeys(range)) {
    buckets.set(slot.key, { count: 0, waits: [] });
  }

  for (const row of rows) {
    const key = volumeKeyForInstant(row.joined_at, range, range.grouping);
    if (!key || !buckets.has(key)) continue;
    const bucket = buckets.get(key)!;
    bucket.count += 1;
    const wait = durationMinutes(row.joined_at, row.called_at);
    if (wait !== null) bucket.waits.push(wait);
  }

  return emptyVolumeKeys(range).map((slot) => {
    const bucket = buckets.get(slot.key)!;
    return {
      key: slot.key,
      label: slot.label,
      count: bucket.count,
      averageWaitMinutes: average(bucket.waits),
    };
  });
}

export function buildWaitTrend(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): VolumePoint[] {
  return buildQueueVolumeSeries(rows, range).map((point) => ({
    ...point,
    count: point.averageWaitMinutes === null ? 0 : 1,
  }));
}

export function buildServiceTrend(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
): VolumePoint[] {
  const buckets = new Map<string, number[]>();
  for (const slot of emptyVolumeKeys(range)) {
    buckets.set(slot.key, []);
  }

  for (const row of rows) {
    if (!row.completed_at) continue;
    const key = volumeKeyForInstant(row.completed_at, range, range.grouping);
    if (!key || !buckets.has(key)) continue;
    const service = durationMinutes(row.called_at, row.completed_at);
    if (service !== null) buckets.get(key)!.push(service);
  }

  return emptyVolumeKeys(range).map((slot) => {
    const values = buckets.get(slot.key)!;
    return {
      key: slot.key,
      label: slot.label,
      count: values.length,
      averageWaitMinutes: average(values),
    };
  });
}

export function buildPeakHours(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
  limit = 5,
): PeakHourRow[] {
  const buckets = Array.from({ length: 24 }, () => ({
    count: 0,
    waits: [] as number[],
  }));

  for (const row of rows) {
    const parts = getZonedDateParts(new Date(row.joined_at), range.timezone);
    if (parts.date < range.startDate || parts.date > range.endDate) continue;
    const bucket = buckets[parts.hour]!;
    bucket.count += 1;
    const wait = durationMinutes(row.joined_at, row.called_at);
    if (wait !== null) bucket.waits.push(wait);
  }

  return buckets
    .map((bucket, hour) => ({
      hour,
      label: formatHourRangeLabel(hour),
      count: bucket.count,
      averageWaitMinutes: average(bucket.waits),
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.hour - b.hour)
    .slice(0, limit);
}

export function summarizeReservations(
  rows: readonly ReservationAnalyticsRow[],
) {
  const summary = {
    total: rows.length,
    pending: 0,
    confirmed: 0,
    arrived: 0,
    seated: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case "PENDING":
        summary.pending += 1;
        break;
      case "CONFIRMED":
        summary.confirmed += 1;
        break;
      case "ARRIVED":
        summary.arrived += 1;
        break;
      case "SEATED":
        summary.seated += 1;
        break;
      case "COMPLETED":
        summary.completed += 1;
        break;
      case "CANCELLED":
        summary.cancelled += 1;
        break;
      case "NO_SHOW":
        summary.noShow += 1;
        break;
    }
  }

  const arrivedOrBeyond =
    summary.arrived + summary.seated + summary.completed;
  const arrivalDenominator = summary.total - summary.cancelled;
  const noShowDenominator =
    summary.confirmed +
    summary.arrived +
    summary.seated +
    summary.completed +
    summary.noShow;

  return {
    ...summary,
    arrivalRate: computeRate(arrivedOrBeyond, arrivalDenominator),
    noShowRate: computeRate(summary.noShow, noShowDenominator),
  };
}

export function buildReservationVolume(
  rows: readonly ReservationAnalyticsRow[],
  range: DashboardDateRange,
): VolumePoint[] {
  const buckets = new Map<string, number>();
  for (const date of listDatesInRange(range.startDate, range.endDate)) {
    buckets.set(date, 0);
  }
  for (const row of rows) {
    if (!buckets.has(row.reservation_date)) continue;
    buckets.set(row.reservation_date, (buckets.get(row.reservation_date) ?? 0) + 1);
  }
  return listDatesInRange(range.startDate, range.endDate).map((date) => ({
    key: date,
    label: date,
    count: buckets.get(date) ?? 0,
    averageWaitMinutes: null,
  }));
}

export function buildCustomerTrends(
  rows: readonly QueueAnalyticsRow[],
  range: DashboardDateRange,
) {
  const byDayBuckets = new Map<string, number>();
  for (const date of listDatesInRange(range.startDate, range.endDate)) {
    byDayBuckets.set(date, 0);
  }
  const byHourBuckets = Array.from({ length: 24 }, () => 0);

  for (const row of rows) {
    if (row.status !== "COMPLETED" && row.status !== "SEATED") continue;
    const parts = getZonedDateParts(new Date(row.joined_at), range.timezone);
    if (parts.date < range.startDate || parts.date > range.endDate) continue;
    byDayBuckets.set(parts.date, (byDayBuckets.get(parts.date) ?? 0) + 1);
    byHourBuckets[parts.hour] = (byHourBuckets[parts.hour] ?? 0) + 1;
  }

  return {
    byDay: listDatesInRange(range.startDate, range.endDate).map((date) => ({
      key: date,
      label: date,
      count: byDayBuckets.get(date) ?? 0,
      averageWaitMinutes: null,
    })),
    byHour: hourLabels().map((label, hour) => ({
      key: label,
      label,
      count: byHourBuckets[hour] ?? 0,
      averageWaitMinutes: null,
    })),
  };
}

export function buildCustomerAnalytics(
  rows: readonly QueueAnalyticsRow[],
  newCustomerIds: ReadonlySet<string>,
  range: DashboardDateRange,
) {
  const served = rows.filter(
    (row) => row.status === "COMPLETED" || row.status === "SEATED",
  );
  const customerIds = new Set(
    served
      .map((row) => row.customer_id)
      .filter((id): id is string => Boolean(id)),
  );

  let newCustomers = 0;
  let returningCustomers = 0;
  for (const id of customerIds) {
    if (newCustomerIds.has(id)) newCustomers += 1;
    else returningCustomers += 1;
  }

  const partySizes = served.map((row) => row.party_size);
  const trends = buildCustomerTrends(rows, range);

  return {
    totalServed: served.length,
    newCustomers,
    returningCustomers,
    averagePartySize: average(partySizes),
    byDay: trends.byDay,
    byHour: trends.byHour,
    partySize: buildPartySizeDistribution([
      ...rows.map((row) => row.party_size),
    ]),
  };
}

export function buildQueueAnalyticsSummary(rows: readonly QueueAnalyticsRow[]) {
  const statuses = summarizeQueueStatuses(rows);
  const waits = summarizeDurations(waitDurations(rows));
  const services = summarizeDurations(serviceDurations(rows));
  return {
    ...statuses,
    averageWaitMinutes: waits.averageMinutes,
    averageServiceMinutes: services.averageMinutes,
    maximumWaitMinutes: waits.maximumMinutes,
  };
}
