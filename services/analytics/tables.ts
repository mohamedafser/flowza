import type { TableAnalyticsSummary } from "@/lib/analytics/types";
import {
  deriveTableStatistics,
  type RestaurantTableRecord,
} from "@/lib/utils/tables";
import type { TableStatus } from "@/lib/validations/table";
import { createClient } from "@/lib/supabase/server";

export async function fetchBranchTables(
  branchId: string,
): Promise<RestaurantTableRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select(
      "id, branch_id, section_id, table_number, name, capacity, status, sort_order",
    )
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Unable to load table analytics.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    branch_id: row.branch_id,
    section_id: row.section_id,
    table_number: row.table_number,
    name: row.name,
    capacity: row.capacity,
    status: row.status as TableStatus,
    sort_order: row.sort_order,
  }));
}

export function getTableAnalytics(
  tables: readonly RestaurantTableRecord[],
): TableAnalyticsSummary {
  return {
    current: deriveTableStatistics(tables),
    utilizationAvailable: false,
    utilizationNote:
      "Historical table utilization is not available yet. Showing current table status only.",
  };
}
