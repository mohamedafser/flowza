import { cache } from "react";
import { AuthorizationError } from "@/lib/auth/guards";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type {
  BranchComparisonRow,
  DashboardBundle,
} from "@/lib/analytics/types";
import type { AnalyticsQueryInput } from "@/lib/validations/analytics";
import { businessDateForTimezone } from "@/lib/queue/tokens";
import { resolveBranchTimezone } from "@/lib/utils/timezone";
import { createClient } from "@/lib/supabase/server";
import {
  loadAuthorizedAnalyticsBranchAny,
  resolveAnalyticsRange,
} from "@/services/analytics/access";
import {
  fetchLiveQueueCounts,
  fetchQueueAnalyticsRows,
  getPeakHours,
  getQueueAnalytics,
  getQueueVolume,
  getServiceTimeAnalytics,
  getWaitTimeAnalytics,
} from "@/services/analytics/queue";
import {
  fetchReservationAnalyticsRows,
  getReservationAnalytics,
} from "@/services/analytics/reservations";
import {
  fetchBranchTables,
  getTableAnalytics,
} from "@/services/analytics/tables";
import {
  fetchWalkInAuditRows,
  getWalkInAnalytics,
} from "@/services/analytics/walk-ins";
import {
  fetchNewCustomerIds,
  getCustomerAnalytics,
} from "@/services/analytics/customers";

function sectionError(error: unknown): { code: string; message: string } {
  if (error instanceof AuthorizationError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "UNKNOWN",
    message: "Unable to load this section. Please try again.",
  };
}

async function safeSection<T>(
  run: () => Promise<T>,
): Promise<{ data: T | null; error: { code: string; message: string } | null }> {
  try {
    return { data: await run(), error: null };
  } catch (error) {
    return { data: null, error: sectionError(error) };
  }
}

async function loadBranchComparison(input: {
  timezoneByBranch: Map<string, string>;
  branchNames: Map<string, string>;
  compareBranchIds: string[];
  rangePreset: AnalyticsQueryInput["preset"];
  startDate?: string;
  endDate?: string;
  now: Date;
}): Promise<BranchComparisonRow[]> {
  const rows: BranchComparisonRow[] = [];

  const settled = await Promise.all(
    input.compareBranchIds.map(async (branchId) => {
      const timezone = input.timezoneByBranch.get(branchId);
      const branchName = input.branchNames.get(branchId);
      if (!timezone || !branchName) return null;

      const range = resolveAnalyticsRange(timezone, {
        preset: input.rangePreset,
        startDate: input.startDate,
        endDate: input.endDate,
        now: input.now,
      });

      const [queueRows, reservationRows] = await Promise.all([
        fetchQueueAnalyticsRows({ branchId, range }),
        fetchReservationAnalyticsRows({ branchId, range }),
      ]);

      const queue = getQueueAnalytics(queueRows);
      const reservations = getReservationAnalytics(reservationRows, range);

      return {
        branchId,
        branchName,
        customersServed: queue.completed,
        queueVolume: queue.total,
        averageWaitMinutes: queue.averageWaitMinutes,
        reservations: reservations.total,
        noShows: queue.noShow + reservations.noShow,
        averageServiceMinutes: queue.averageServiceMinutes,
      } satisfies BranchComparisonRow;
    }),
  );

  for (const row of settled) {
    if (row) rows.push(row);
  }

  return rows;
}

export const getDashboardOverview = cache(
  async (
    input: AnalyticsQueryInput,
    options?: { now?: Date },
  ): Promise<DashboardBundle> => {
    const now = options?.now ?? new Date();

    const permissionCandidates: Permission[] = [
      "queue.view",
      "tables.view",
      "reservations.view",
      "customers.view",
      "analytics.view",
    ];

    const authorized = await loadAuthorizedAnalyticsBranchAny(
      input.branchId,
      permissionCandidates,
    );

    const role = authorized.context.role;
    const permissions = {
      canViewQueue: hasPermission(role, "queue.view"),
      canViewTables: hasPermission(role, "tables.view"),
      canViewReservations: hasPermission(role, "reservations.view"),
      canViewCustomers: hasPermission(role, "customers.view"),
      canViewAnalytics: hasPermission(role, "analytics.view"),
    };

    const range = resolveAnalyticsRange(authorized.timezone, {
      preset: input.preset,
      startDate: input.startDate,
      endDate: input.endDate,
      now,
    });

    const today = businessDateForTimezone(now, authorized.timezone);
    const sectionErrors: DashboardBundle["sectionErrors"] = {};

    const [
      queueRowsResult,
      liveResult,
      tablesResult,
      reservationsResult,
      walkInsResult,
      customersResult,
    ] = await Promise.all([
      permissions.canViewQueue
        ? safeSection(() =>
            fetchQueueAnalyticsRows({
              branchId: authorized.branch.id,
              range,
            }),
          )
        : Promise.resolve({ data: [], error: null }),
      permissions.canViewQueue
        ? safeSection(() =>
            fetchLiveQueueCounts({
              branchId: authorized.branch.id,
              businessDate: today,
            }),
          )
        : Promise.resolve({
            data: {
              waiting: 0,
              serving: 0,
              servedToday: 0,
              queueId: null as string | null,
              estimatedServiceMinutes: null as number | null,
            },
            error: null,
          }),
      permissions.canViewTables
        ? safeSection(() => fetchBranchTables(authorized.branch.id))
        : Promise.resolve({ data: [], error: null }),
      permissions.canViewReservations
        ? safeSection(() =>
            fetchReservationAnalyticsRows({
              branchId: authorized.branch.id,
              range,
            }),
          )
        : Promise.resolve({ data: [], error: null }),
      permissions.canViewReservations || permissions.canViewQueue
        ? safeSection(() =>
            fetchWalkInAuditRows({
              restaurantId: authorized.branch.restaurant_id,
              branchId: authorized.branch.id,
              range,
            }),
          )
        : Promise.resolve({ data: [], error: null }),
      permissions.canViewCustomers
        ? safeSection(() =>
            fetchNewCustomerIds({
              restaurantId: authorized.branch.restaurant_id,
              range,
            }),
          )
        : Promise.resolve({ data: new Set<string>(), error: null }),
    ]);

    if (queueRowsResult.error) sectionErrors.queue = queueRowsResult.error;
    if (liveResult.error) sectionErrors.operational = liveResult.error;
    if (tablesResult.error) sectionErrors.tables = tablesResult.error;
    if (reservationsResult.error) {
      sectionErrors.reservations = reservationsResult.error;
    }
    if (walkInsResult.error) sectionErrors.walkIns = walkInsResult.error;
    if (customersResult.error) sectionErrors.customers = customersResult.error;

    const queueRows = queueRowsResult.data ?? [];
    const tables = tablesResult.data ?? [];
    const reservationRows = reservationsResult.data ?? [];
    const live = liveResult.data;
    const tableStats = getTableAnalytics(tables);

    const operational =
      permissions.canViewQueue || permissions.canViewTables
        ? {
            waitingCustomers: live?.waiting ?? 0,
            currentlyServing: live?.serving ?? 0,
            availableTables: tableStats.current.available,
            servedToday: live?.servedToday ?? 0,
            estimatedWaitMinutes: live?.estimatedServiceMinutes ?? null,
          }
        : null;

    const queue = permissions.canViewQueue
      ? getQueueAnalytics(queueRows)
      : null;

    const waitTime = permissions.canViewQueue
      ? getWaitTimeAnalytics(queueRows, range)
      : null;
    const serviceTime = permissions.canViewQueue
      ? getServiceTimeAnalytics(queueRows, range)
      : null;

    const peakHours =
      permissions.canViewQueue && permissions.canViewAnalytics
        ? getPeakHours(queueRows, range)
        : [];

    const queueVolume = permissions.canViewQueue
      ? getQueueVolume(queueRows, range)
      : [];

    const reservations = permissions.canViewReservations
      ? getReservationAnalytics(reservationRows, range)
      : null;

    const walkIns =
      permissions.canViewReservations || permissions.canViewQueue
        ? getWalkInAnalytics({
            auditRows: walkInsResult.data ?? [],
            queueRows,
          })
        : null;

    const customerAnalytics =
      permissions.canViewCustomers || permissions.canViewAnalytics
        ? getCustomerAnalytics(
            queueRows,
            customersResult.data ?? new Set(),
            range,
          )
        : null;

    let branchComparison: BranchComparisonRow[] | null = null;
    if (
      permissions.canViewAnalytics &&
      input.compareBranchIds &&
      input.compareBranchIds.length > 0
    ) {
      const compareResult = await safeSection(async () => {
        const supabase = await createClient();
        const uniqueIds = Array.from(new Set(input.compareBranchIds));

        const { data: branches, error } = await supabase
          .from("branches")
          .select("id, name, timezone, use_restaurant_timezone, restaurant_id")
          .eq("restaurant_id", authorized.branch.restaurant_id)
          .in("id", uniqueIds);

        if (error) {
          throw new Error("Unable to load branch comparison.");
        }

        const allowed = (branches ?? []).filter(
          (branch) => branch.restaurant_id === authorized.branch.restaurant_id,
        );

        const timezoneByBranch = new Map<string, string>();
        const branchNames = new Map<string, string>();
        for (const branch of allowed) {
          timezoneByBranch.set(
            branch.id,
            resolveBranchTimezone({
              restaurantTimezone: authorized.restaurantTimezone,
              branchTimezone: branch.timezone,
              useRestaurantTimezone: branch.use_restaurant_timezone,
            }),
          );
          branchNames.set(branch.id, branch.name);
        }

        return loadBranchComparison({
          timezoneByBranch,
          branchNames,
          compareBranchIds: allowed.map((branch) => branch.id),
          rangePreset: input.preset,
          startDate: input.startDate,
          endDate: input.endDate,
          now,
        });
      });

      if (compareResult.error) {
        sectionErrors.branchComparison = compareResult.error;
      } else {
        branchComparison = compareResult.data;
      }
    }

    return {
      restaurantId: authorized.branch.restaurant_id,
      branchId: authorized.branch.id,
      branchName: authorized.branch.name,
      timezone: authorized.timezone,
      range,
      permissions,
      queueId: live?.queueId ?? null,
      estimatedServiceMinutes: live?.estimatedServiceMinutes ?? null,
      operational,
      queue,
      waitTime: waitTime
        ? {
            ...waitTime,
            trend: permissions.canViewAnalytics ? waitTime.trend : [],
          }
        : null,
      serviceTime: serviceTime
        ? {
            ...serviceTime,
            trend: permissions.canViewAnalytics ? serviceTime.trend : [],
          }
        : null,
      peakHours,
      queueVolume: permissions.canViewAnalytics ? queueVolume : [],
      tables: permissions.canViewTables ? tableStats : null,
      reservations,
      walkIns,
      customers: customerAnalytics
        ? {
            totalServed: customerAnalytics.totalServed,
            newCustomers: customerAnalytics.newCustomers,
            returningCustomers: customerAnalytics.returningCustomers,
            averagePartySize: customerAnalytics.averagePartySize,
            byDay: customerAnalytics.byDay,
            byHour: permissions.canViewAnalytics
              ? customerAnalytics.byHour
              : [],
          }
        : null,
      partySize:
        permissions.canViewAnalytics || permissions.canViewCustomers
          ? (customerAnalytics?.partySize ?? [])
          : [],
      branchComparison,
      sectionErrors,
    };
  },
);

export async function getDashboardOverviewForBranch(
  branchId: string,
  query?: Omit<AnalyticsQueryInput, "branchId">,
): Promise<DashboardBundle> {
  return getDashboardOverview({
    branchId,
    preset: query?.preset ?? "today",
    startDate: query?.startDate,
    endDate: query?.endDate,
    compareBranchIds: query?.compareBranchIds,
  });
}
