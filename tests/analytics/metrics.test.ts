import { describe, expect, it } from "vitest";
import {
  buildCustomerAnalytics,
  buildPeakHours,
  buildQueueAnalyticsSummary,
  buildQueueVolumeSeries,
  summarizeReservations,
  waitDurations,
  serviceDurations,
  type QueueAnalyticsRow,
  type ReservationAnalyticsRow,
} from "@/lib/analytics/aggregations";
import { getDashboardDateRange } from "@/lib/analytics/date-range";
import {
  buildPartySizeDistribution,
  computeRate,
  durationMinutes,
  summarizeDurations,
} from "@/lib/analytics/metrics";

describe("analytics metric calculations", () => {
  const baseRange = getDashboardDateRange({
    branchTimezone: "UTC",
    preset: "today",
    now: new Date("2026-09-19T15:00:00.000Z"),
  });

  const queueRows: QueueAnalyticsRow[] = [
    {
      id: "1",
      customer_id: "c1",
      reservation_id: null,
      party_size: 2,
      status: "COMPLETED",
      business_date: "2026-09-19",
      joined_at: "2026-09-19T12:00:00.000Z",
      called_at: "2026-09-19T12:10:00.000Z",
      seated_at: "2026-09-19T12:12:00.000Z",
      completed_at: "2026-09-19T12:40:00.000Z",
    },
    {
      id: "2",
      customer_id: "c2",
      reservation_id: null,
      party_size: 5,
      status: "NO_SHOW",
      business_date: "2026-09-19",
      joined_at: "2026-09-19T13:00:00.000Z",
      called_at: "2026-09-19T13:20:00.000Z",
      seated_at: null,
      completed_at: null,
    },
    {
      id: "3",
      customer_id: "c1",
      reservation_id: null,
      party_size: 8,
      status: "CANCELLED",
      business_date: "2026-09-19",
      joined_at: "2026-09-19T18:00:00.000Z",
      called_at: null,
      seated_at: null,
      completed_at: null,
    },
    {
      id: "4",
      customer_id: "c3",
      reservation_id: null,
      party_size: 3,
      status: "WAITING",
      business_date: "2026-09-19",
      joined_at: "2026-09-19T14:00:00.000Z",
      called_at: null,
      seated_at: null,
      completed_at: null,
    },
  ];

  it("ignores missing timestamps instead of treating them as zero", () => {
    expect(durationMinutes("2026-09-19T12:00:00.000Z", null)).toBeNull();
    expect(durationMinutes(null, "2026-09-19T12:00:00.000Z")).toBeNull();
    expect(
      summarizeDurations([10, null, undefined, -1, 20]).averageMinutes,
    ).toBe(15);
  });

  it("computes average, median, and maximum wait", () => {
    const waits = waitDurations(queueRows);
    const stats = summarizeDurations(waits);
    expect(stats.sampleSize).toBe(2);
    expect(stats.averageMinutes).toBe(15);
    expect(stats.medianMinutes).toBe(15);
    expect(stats.maximumMinutes).toBe(20);
  });

  it("computes service time only when called and completed exist", () => {
    const services = serviceDurations(queueRows);
    expect(services).toEqual([30]);
    expect(summarizeDurations(services).averageMinutes).toBe(30);
  });

  it("summarizes queue counts", () => {
    const summary = buildQueueAnalyticsSummary(queueRows);
    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(1);
    expect(summary.noShow).toBe(1);
    expect(summary.cancelled).toBe(1);
    expect(summary.waiting).toBe(1);
    expect(summary.averageWaitMinutes).toBe(15);
    expect(summary.averageServiceMinutes).toBe(30);
    expect(summary.maximumWaitMinutes).toBe(20);
  });

  it("aggregates peak hours in branch timezone", () => {
    const peaks = buildPeakHours(queueRows, baseRange, 3);
    expect(peaks[0]?.hour).toBe(12);
    expect(peaks[0]?.count).toBe(1);
    expect(peaks[0]?.averageWaitMinutes).toBe(10);
  });

  it("builds queue volume series", () => {
    const volume = buildQueueVolumeSeries(queueRows, baseRange);
    const noon = volume.find((point) => point.key === "12:00");
    expect(noon?.count).toBe(1);
  });

  it("computes reservation rates without dividing by zero", () => {
    const empty = summarizeReservations([]);
    expect(empty.arrivalRate.rate).toBeNull();
    expect(empty.noShowRate.rate).toBeNull();

    const rows: ReservationAnalyticsRow[] = [
      {
        id: "r1",
        customer_id: "c1",
        party_size: 2,
        status: "COMPLETED",
        reservation_date: "2026-09-19",
        start_time: "19:00:00",
      },
      {
        id: "r2",
        customer_id: "c2",
        party_size: 4,
        status: "NO_SHOW",
        reservation_date: "2026-09-19",
        start_time: "20:00:00",
      },
      {
        id: "r3",
        customer_id: "c3",
        party_size: 2,
        status: "CANCELLED",
        reservation_date: "2026-09-19",
        start_time: "21:00:00",
      },
    ];

    const summary = summarizeReservations(rows);
    expect(summary.total).toBe(3);
    expect(summary.noShow).toBe(1);
    expect(summary.arrivalRate.rate).toBe(0.5);
    expect(summary.noShowRate.rate).toBe(0.5);
    expect(computeRate(0, 0).rate).toBeNull();
  });

  it("builds party size buckets", () => {
    const buckets = buildPartySizeDistribution(
      queueRows.map((row) => row.party_size),
    );
    expect(buckets.find((bucket) => bucket.key === "1-2")?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.key === "3-4")?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.key === "5-6")?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.key === "7+")?.count).toBe(1);
  });

  it("classifies new vs returning customers without PII", () => {
    const analytics = buildCustomerAnalytics(
      queueRows,
      new Set(["c3"]),
      baseRange,
    );
    expect(analytics.totalServed).toBe(1);
    expect(analytics.newCustomers).toBe(0);
    expect(analytics.returningCustomers).toBe(1);
    expect(analytics.averagePartySize).toBe(2);
  });

  it("handles empty datasets safely", () => {
    const summary = buildQueueAnalyticsSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.averageWaitMinutes).toBeNull();
    expect(buildPeakHours([], baseRange)).toEqual([]);
  });
});
