import type { UsageResource, UsageSummary } from "@/lib/billing/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function emptyUsage(periodStart: string, periodEnd: string): UsageSummary {
  return {
    branches: 0,
    staff: 0,
    tables: 0,
    queue_entries: 0,
    reservations: 0,
    displays: 0,
    period_start: periodStart,
    period_end: periodEnd,
  };
}

function parseUsage(raw: unknown, fallbackStart: string, fallbackEnd: string): UsageSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyUsage(fallbackStart, fallbackEnd);
  }
  const obj = raw as Record<string, unknown>;
  const num = (key: string) =>
    typeof obj[key] === "number" && Number.isFinite(obj[key])
      ? (obj[key] as number)
      : 0;

  return {
    branches: num("branches"),
    staff: num("staff"),
    tables: num("tables"),
    queue_entries: num("queue_entries"),
    reservations: num("reservations"),
    displays: num("displays"),
    period_start:
      typeof obj.period_start === "string" ? obj.period_start : fallbackStart,
    period_end:
      typeof obj.period_end === "string" ? obj.period_end : fallbackEnd,
  };
}

/**
 * Aggregated restaurant usage for the given billing period.
 * Uses a SECURITY DEFINER RPC so clients never pull full historical rows.
 */
export async function getUsageSummary(
  restaurantId: string,
  periodStart?: string | null,
  periodEnd?: string | null,
): Promise<UsageSummary> {
  const now = new Date();
  const fallbackStart =
    periodStart ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const fallbackEnd = periodEnd ?? now.toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("billing_usage_summary", {
    p_restaurant_id: restaurantId,
    p_period_start: periodStart ?? null,
    p_period_end: periodEnd ?? null,
  });

  if (!error && data) {
    return parseUsage(data, fallbackStart, fallbackEnd);
  }

  // Fallback for environments where the RPC is not yet migrated.
  return countUsageFallback(restaurantId, fallbackStart, fallbackEnd);
}

export async function getUsageSummaryAdmin(
  restaurantId: string,
  periodStart?: string | null,
  periodEnd?: string | null,
): Promise<UsageSummary> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return getUsageSummary(restaurantId, periodStart, periodEnd);
  }

  const now = new Date();
  const fallbackStart =
    periodStart ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const fallbackEnd = periodEnd ?? now.toISOString();

  const { data, error } = await admin.rpc("billing_usage_summary", {
    p_restaurant_id: restaurantId,
    p_period_start: periodStart ?? null,
    p_period_end: periodEnd ?? null,
  });

  if (!error && data) {
    return parseUsage(data, fallbackStart, fallbackEnd);
  }

  return countUsageFallback(restaurantId, fallbackStart, fallbackEnd, true);
}

async function countUsageFallback(
  restaurantId: string,
  periodStart: string,
  periodEnd: string,
  useAdmin = false,
): Promise<UsageSummary> {
  const supabase = useAdmin
    ? createServiceRoleClient()
    : await createClient();
  if (!supabase) {
    return emptyUsage(periodStart, periodEnd);
  }

  const [branches, staff, tables, queueEntries, reservations, displays] =
    await Promise.all([
      supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true),
      supabase
        .from("restaurant_members")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("status", "ACTIVE"),
      supabase
        .from("restaurant_tables")
        .select("id, branch:branches!inner(restaurant_id)", {
          count: "exact",
          head: true,
        })
        .eq("branch.restaurant_id", restaurantId),
      supabase
        .from("queue_entries")
        .select("id, queue:queues!inner(branch:branches!inner(restaurant_id))", {
          count: "exact",
          head: true,
        })
        .eq("queue.branch.restaurant_id", restaurantId)
        .gte("created_at", periodStart)
        .lt("created_at", periodEnd),
      supabase
        .from("reservations")
        .select("id, branch:branches!inner(restaurant_id)", {
          count: "exact",
          head: true,
        })
        .eq("branch.restaurant_id", restaurantId)
        .gte("created_at", periodStart)
        .lt("created_at", periodEnd),
      supabase
        .from("displays")
        .select("id, branch:branches!inner(restaurant_id)", {
          count: "exact",
          head: true,
        })
        .eq("branch.restaurant_id", restaurantId)
        .eq("is_active", true),
    ]);

  return {
    branches: branches.count ?? 0,
    staff: staff.count ?? 0,
    tables: tables.count ?? 0,
    queue_entries: queueEntries.count ?? 0,
    reservations: reservations.count ?? 0,
    displays: displays.count ?? 0,
    period_start: periodStart,
    period_end: periodEnd,
  };
}

export function usageValue(
  usage: UsageSummary,
  resource: UsageResource,
): number {
  return usage[resource];
}
