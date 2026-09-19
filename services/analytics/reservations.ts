import {
  buildReservationVolume,
  summarizeReservations,
  type ReservationAnalyticsRow,
} from "@/lib/analytics/aggregations";
import type { DashboardDateRange } from "@/lib/analytics/date-range";
import type { ReservationAnalyticsSummary } from "@/lib/analytics/types";
import { createClient } from "@/lib/supabase/server";
import type { ReservationStatus } from "@/lib/validations/reservation";

const RESERVATION_ANALYTICS_SELECT =
  "id, customer_id, party_size, status, reservation_date, start_time";

export async function fetchReservationAnalyticsRows(input: {
  branchId: string;
  range: DashboardDateRange;
}): Promise<ReservationAnalyticsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_ANALYTICS_SELECT)
    .eq("branch_id", input.branchId)
    .gte("reservation_date", input.range.startDate)
    .lte("reservation_date", input.range.endDate)
    .order("reservation_date", { ascending: true });

  if (error) {
    throw new Error("Unable to load reservation analytics.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    party_size: row.party_size,
    status: row.status as ReservationStatus,
    reservation_date: row.reservation_date,
    start_time: row.start_time,
  }));
}

export function getReservationAnalytics(
  rows: readonly ReservationAnalyticsRow[],
  range: DashboardDateRange,
): ReservationAnalyticsSummary {
  const summary = summarizeReservations(rows);
  return {
    ...summary,
    volume: buildReservationVolume(rows, range),
  };
}
