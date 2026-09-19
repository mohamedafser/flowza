import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import type { AnalyticsExportInput } from "@/lib/validations/analytics";
import {
  formatPercent,
  roundMinutes,
} from "@/lib/analytics/metrics";
import { writeAuditLog } from "@/services/audit";
import { getDashboardOverview } from "@/services/analytics/dashboard";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null>>) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export async function exportAnalyticsCsv(input: AnalyticsExportInput): Promise<{
  filename: string;
  csv: string;
}> {
  const auth = await requireVerifiedAuth();
  const bundle = await getDashboardOverview(input);

  if (!bundle.permissions.canViewAnalytics) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to export analytics.",
    );
  }

  const rangeLabel = `${bundle.range.startDate}_to_${bundle.range.endDate}`;
  let csv = "";
  const filename = `flowza-${input.kind}-${rangeLabel}.csv`;

  if (input.kind === "queue_summary") {
    if (!bundle.permissions.canViewQueue || !bundle.queue) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "You do not have permission to export queue analytics.",
      );
    }
    csv = toCsv(
      [
        "branch",
        "start_date",
        "end_date",
        "total",
        "waiting",
        "called",
        "seated",
        "completed",
        "skipped",
        "cancelled",
        "no_show",
        "average_wait_minutes",
        "average_service_minutes",
        "maximum_wait_minutes",
      ],
      [
        [
          bundle.branchName,
          bundle.range.startDate,
          bundle.range.endDate,
          bundle.queue.total,
          bundle.queue.waiting,
          bundle.queue.called,
          bundle.queue.seated,
          bundle.queue.completed,
          bundle.queue.skipped,
          bundle.queue.cancelled,
          bundle.queue.noShow,
          roundMinutes(bundle.queue.averageWaitMinutes),
          roundMinutes(bundle.queue.averageServiceMinutes),
          roundMinutes(bundle.queue.maximumWaitMinutes),
        ],
      ],
    );
  } else if (input.kind === "reservation_summary") {
    if (!bundle.permissions.canViewReservations || !bundle.reservations) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "You do not have permission to export reservation analytics.",
      );
    }
    csv = toCsv(
      [
        "branch",
        "start_date",
        "end_date",
        "total",
        "pending",
        "confirmed",
        "arrived",
        "seated",
        "completed",
        "cancelled",
        "no_show",
        "arrival_rate",
        "no_show_rate",
      ],
      [
        [
          bundle.branchName,
          bundle.range.startDate,
          bundle.range.endDate,
          bundle.reservations.total,
          bundle.reservations.pending,
          bundle.reservations.confirmed,
          bundle.reservations.arrived,
          bundle.reservations.seated,
          bundle.reservations.completed,
          bundle.reservations.cancelled,
          bundle.reservations.noShow,
          formatPercent(bundle.reservations.arrivalRate.rate),
          formatPercent(bundle.reservations.noShowRate.rate),
        ],
      ],
    );
  } else {
    if (!bundle.permissions.canViewCustomers || !bundle.customers) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "You do not have permission to export customer analytics.",
      );
    }
    csv = toCsv(
      [
        "branch",
        "start_date",
        "end_date",
        "total_served",
        "new_customers",
        "returning_customers",
        "average_party_size",
      ],
      [
        [
          bundle.branchName,
          bundle.range.startDate,
          bundle.range.endDate,
          bundle.customers.totalServed,
          bundle.customers.newCustomers,
          bundle.customers.returningCustomers,
          roundMinutes(bundle.customers.averagePartySize),
        ],
      ],
    );
  }

  await writeAuditLog({
    restaurantId: bundle.restaurantId,
    userId: auth.user.id,
    action: "analytics.exported",
    entityType: "restaurant",
    entityId: bundle.restaurantId,
    metadata: {
      branchId: bundle.branchId,
      kind: input.kind,
      startDate: bundle.range.startDate,
      endDate: bundle.range.endDate,
      preset: bundle.range.preset,
    },
  });

  return { filename, csv };
}
