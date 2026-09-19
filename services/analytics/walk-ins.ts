import { durationMinutes, computeRate } from "@/lib/analytics/metrics";
import type { DashboardDateRange } from "@/lib/analytics/date-range";
import type { WalkInAnalyticsSummary } from "@/lib/analytics/types";
import type { QueueAnalyticsRow } from "@/lib/analytics/aggregations";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type AuditWalkInRow = {
  action: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
};

function metadataBranchId(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, Json | undefined>).branchId;
  return typeof value === "string" ? value : null;
}

export async function fetchWalkInAuditRows(input: {
  restaurantId: string;
  branchId: string;
  range: DashboardDateRange;
}): Promise<AuditWalkInRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("action, entity_id, metadata, created_at")
    .eq("restaurant_id", input.restaurantId)
    .in("action", ["walk_in.created", "walk_in.seated"])
    .gte("created_at", input.range.startAt)
    .lt("created_at", input.range.endAtExclusive)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load walk-in analytics.");
  }

  return (data ?? []).filter((row) => {
    const branchId = metadataBranchId(row.metadata);
    return branchId === input.branchId;
  }) as AuditWalkInRow[];
}

export function getWalkInAnalytics(input: {
  auditRows: readonly AuditWalkInRow[];
  queueRows: readonly QueueAnalyticsRow[];
}): WalkInAnalyticsSummary {
  const addedToQueue = input.auditRows.filter(
    (row) => row.action === "walk_in.created",
  );
  const seatedDirectly = input.auditRows.filter(
    (row) => row.action === "walk_in.seated",
  );

  const queuedEntryIds = new Set(addedToQueue.map((row) => row.entity_id));
  const queuedEntries = input.queueRows.filter((row) =>
    queuedEntryIds.has(row.id),
  );

  const waits = queuedEntries
    .map((row) => durationMinutes(row.joined_at, row.called_at))
    .filter((value): value is number => value !== null);

  const completed = queuedEntries.filter(
    (row) => row.status === "COMPLETED" || row.status === "SEATED",
  ).length;

  return {
    total: addedToQueue.length + seatedDirectly.length,
    addedToQueue: addedToQueue.length,
    seatedDirectly: seatedDirectly.length,
    averageWaitMinutes:
      waits.length === 0
        ? null
        : waits.reduce((sum, value) => sum + value, 0) / waits.length,
    completionRate: computeRate(completed, addedToQueue.length),
    basedOnAuditLogs: true,
  };
}
