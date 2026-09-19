import { JSON_ACCEPT, parseJsonResult, toSearchParams } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type { DashboardBundle } from "@/lib/analytics/types";
import type {
  AnalyticsExportInput,
  AnalyticsQueryInput,
} from "@/lib/validations/analytics";

export async function getDashboardAnalyticsRequest(
  query: AnalyticsQueryInput,
): Promise<ActionResult<DashboardBundle>> {
  const params = toSearchParams({
    branchId: query.branchId,
    preset: query.preset,
    startDate: query.startDate,
    endDate: query.endDate,
    compareBranchIds: query.compareBranchIds?.join(","),
  });
  const response = await fetch(`/api/analytics/dashboard?${params}`, {
    method: "GET",
    headers: JSON_ACCEPT,
    cache: "no-store",
  });
  return parseJsonResult(response);
}

export function analyticsExportUrl(query: AnalyticsExportInput): string {
  const params = toSearchParams({
    branchId: query.branchId,
    preset: query.preset,
    startDate: query.startDate,
    endDate: query.endDate,
    kind: query.kind,
  });
  return `/api/analytics/export?${params}`;
}
