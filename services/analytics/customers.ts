import { buildCustomerAnalytics } from "@/lib/analytics/aggregations";
import type { QueueAnalyticsRow } from "@/lib/analytics/aggregations";
import type { DashboardDateRange } from "@/lib/analytics/date-range";
import type { CustomerAnalyticsSummary } from "@/lib/analytics/types";
import { createClient } from "@/lib/supabase/server";

export async function fetchNewCustomerIds(input: {
  restaurantId: string;
  range: DashboardDateRange;
}): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .gte("created_at", input.range.startAt)
    .lt("created_at", input.range.endAtExclusive);

  if (error) {
    throw new Error("Unable to load customer analytics.");
  }

  return new Set((data ?? []).map((row) => row.id));
}

export function getCustomerAnalytics(
  rows: readonly QueueAnalyticsRow[],
  newCustomerIds: ReadonlySet<string>,
  range: DashboardDateRange,
): CustomerAnalyticsSummary & {
  partySize: ReturnType<typeof buildCustomerAnalytics>["partySize"];
} {
  return buildCustomerAnalytics(rows, newCustomerIds, range);
}
