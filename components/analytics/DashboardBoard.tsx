"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Footprints,
  GitCompareArrows,
  LayoutGrid,
  ListOrdered,
  RefreshCw,
  Timer,
  TrendingUp,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardDateRangePicker } from "@/components/analytics/DashboardDateRangePicker";
import {
  DonutChart,
  HorizontalMeter,
  SegmentBar,
  SimpleBarChart,
  SimpleLineChart,
} from "@/components/analytics/Charts";
import { SectionSkeleton } from "@/components/analytics/DashboardSkeletons";
import { useDashboardRealtime } from "@/hooks/realtime/use-dashboard-realtime";
import {
  analyticsExportUrl,
  getDashboardAnalyticsRequest,
} from "@/lib/api/analytics-client";
import type { DashboardDatePreset } from "@/lib/analytics/date-range";
import type { DashboardBundle } from "@/lib/analytics/types";
import {
  formatCount,
  formatMinutes,
  formatPercent,
  roundMinutes,
} from "@/lib/analytics/metrics";
import { cn } from "@/lib/utils";

type ComparableBranch = {
  id: string;
  name: string;
};

type DashboardBoardProps = {
  initialBundle: DashboardBundle;
  restaurantId: string;
  comparableBranches: ComparableBranch[];
  mode?: "overview" | "analytics";
};

function MetricTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card flex min-w-0 flex-col justify-between rounded-lg border px-3 py-2.5",
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium tracking-wide uppercase">
          {label}
        </span>
        {icon ? <span className="shrink-0 [&_svg]:size-3.5">{icon}</span> : null}
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pt-0 pb-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {icon ? (
            <span className="text-muted-foreground [&_svg]:size-3.5">
              {icon}
            </span>
          ) : null}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-3 pb-3">{children}</CardContent>
    </Card>
  );
}

function LegendList({
  items,
}: {
  items: Array<{ key: string; label: string; value: string; swatch: string }>;
}) {
  return (
    <ul className="min-w-0 flex-1 space-y-1.5">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-center justify-between gap-2 text-xs"
        >
          <span className="text-muted-foreground flex min-w-0 items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", item.swatch)} />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="font-medium tabular-nums">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function DashboardBoard({
  initialBundle,
  restaurantId,
  comparableBranches,
  mode = "overview",
}: DashboardBoardProps) {
  const [bundle, setBundle] = useState(initialBundle);
  const [preset, setPreset] = useState<DashboardDatePreset>(
    initialBundle.range.preset,
  );
  const [startDate, setStartDate] = useState(initialBundle.range.startDate);
  const [endDate, setEndDate] = useState(initialBundle.range.endDate);
  const [compareBranchIds, setCompareBranchIds] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sectionLoading, setSectionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refresh(options?: {
    preset?: DashboardDatePreset;
    startDate?: string;
    endDate?: string;
    compareBranchIds?: string[];
  }) {
    setSectionLoading(true);
    setLoadError(null);
    const result = await getDashboardAnalyticsRequest({
      branchId: bundle.branchId,
      preset: options?.preset ?? preset,
      startDate: options?.startDate ?? startDate,
      endDate: options?.endDate ?? endDate,
      compareBranchIds: options?.compareBranchIds ?? compareBranchIds,
    });
    setSectionLoading(false);

    if (!result.ok || !result.data) {
      setLoadError(result.message ?? "Unable to refresh dashboard.");
      return;
    }

    setBundle(result.data);
  }

  useDashboardRealtime({
    restaurantId,
    branchId: bundle.branchId,
    queueId: bundle.queueId,
    enabled: preset === "today",
    onRefresh: () => {
      startTransition(() => {
        void refresh();
      });
    },
  });

  function handlePresetChange(next: DashboardDatePreset) {
    setPreset(next);
    startTransition(() => {
      void refresh({ preset: next });
    });
  }

  function handleCustomApply() {
    if (!startDate || !endDate) {
      toast.error("Choose both start and end dates.");
      return;
    }
    startTransition(() => {
      void refresh({ preset: "custom", startDate, endDate });
    });
  }

  function toggleCompareBranch(branchId: string) {
    const scroller = document.querySelector<HTMLElement>(
      "[data-app-shell-scroll]",
    );
    const scrollTop = scroller?.scrollTop ?? 0;

    const next = compareBranchIds.includes(branchId)
      ? compareBranchIds.filter((id) => id !== branchId)
      : [...compareBranchIds, branchId];
    setCompareBranchIds(next);

    if (next.length === 0) {
      setCompareLoading(false);
      setBundle((current) => ({ ...current, branchComparison: null }));
      return;
    }

    setCompareLoading(true);
    startTransition(() => {
      void (async () => {
        try {
          await refresh({ compareBranchIds: next });
        } finally {
          setCompareLoading(false);
          requestAnimationFrame(() => {
            if (scroller) {
              scroller.scrollTop = scrollTop;
            }
          });
        }
      })();
    });
  }

  function downloadExport(
    kind: "queue_summary" | "reservation_summary" | "customer_summary",
  ) {
    const url = analyticsExportUrl({
      branchId: bundle.branchId,
      preset,
      startDate,
      endDate,
      kind,
    });
    window.location.assign(url);
  }

  const showAnalytics = bundle.permissions.canViewAnalytics;
  const deep = mode === "analytics" || showAnalytics;
  const busy = isPending || sectionLoading;

  const queueDonut = bundle.queue
    ? [
        {
          key: "waiting",
          label: "Waiting",
          value: bundle.queue.waiting,
          colorClass: "stroke-primary",
          swatch: "bg-primary",
        },
        {
          key: "called",
          label: "Called",
          value: bundle.queue.called,
          colorClass: "stroke-chart-2",
          swatch: "bg-chart-2",
        },
        {
          key: "seated",
          label: "Seated",
          value: bundle.queue.seated,
          colorClass: "stroke-chart-3",
          swatch: "bg-chart-3",
        },
        {
          key: "completed",
          label: "Completed",
          value: bundle.queue.completed,
          colorClass: "stroke-chart-4",
          swatch: "bg-chart-4",
        },
        {
          key: "skipped",
          label: "Skipped",
          value: bundle.queue.skipped,
          colorClass: "stroke-muted-foreground",
          swatch: "bg-muted-foreground",
        },
        {
          key: "cancelled",
          label: "Cancelled",
          value: bundle.queue.cancelled,
          colorClass: "stroke-chart-5",
          swatch: "bg-chart-5",
        },
        {
          key: "noShow",
          label: "No-show",
          value: bundle.queue.noShow,
          colorClass: "stroke-destructive",
          swatch: "bg-destructive",
        },
      ]
    : [];

  const reservationDonut = bundle.reservations
    ? [
        {
          key: "confirmed",
          label: "Confirmed",
          value: bundle.reservations.confirmed,
          colorClass: "stroke-primary",
          swatch: "bg-primary",
        },
        {
          key: "arrived",
          label: "Arrived",
          value: bundle.reservations.arrived,
          colorClass: "stroke-chart-2",
          swatch: "bg-chart-2",
        },
        {
          key: "seated",
          label: "Seated",
          value: bundle.reservations.seated,
          colorClass: "stroke-chart-3",
          swatch: "bg-chart-3",
        },
        {
          key: "completed",
          label: "Completed",
          value: bundle.reservations.completed,
          colorClass: "stroke-chart-4",
          swatch: "bg-chart-4",
        },
        {
          key: "cancelled",
          label: "Cancelled",
          value: bundle.reservations.cancelled,
          colorClass: "stroke-chart-5",
          swatch: "bg-chart-5",
        },
        {
          key: "noShow",
          label: "No-show",
          value: bundle.reservations.noShow,
          colorClass: "stroke-destructive",
          swatch: "bg-destructive",
        },
        {
          key: "pending",
          label: "Pending",
          value: bundle.reservations.pending,
          colorClass: "stroke-muted-foreground",
          swatch: "bg-muted-foreground",
        },
      ]
    : [];

  const tableSegments = bundle.tables
    ? [
        {
          key: "available",
          label: "Available",
          value: bundle.tables.current.available,
          colorClass: "bg-primary",
          swatch: "bg-primary",
        },
        {
          key: "occupied",
          label: "Occupied",
          value: bundle.tables.current.occupied,
          colorClass: "bg-chart-2",
          swatch: "bg-chart-2",
        },
        {
          key: "cleaning",
          label: "Cleaning",
          value: bundle.tables.current.cleaning,
          colorClass: "bg-chart-3",
          swatch: "bg-chart-3",
        },
        {
          key: "reserved",
          label: "Reserved",
          value: bundle.tables.current.reserved,
          colorClass: "bg-chart-4",
          swatch: "bg-chart-4",
        },
        {
          key: "blocked",
          label: "Blocked",
          value: bundle.tables.current.blocked,
          colorClass: "bg-muted-foreground",
          swatch: "bg-muted-foreground",
        },
      ]
    : [];

  const peakMax = Math.max(1, ...bundle.peakHours.map((row) => row.count));

  return (
    <div className="space-y-4">
      <div className="border-border bg-card/60 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <DashboardDateRangePicker
          preset={preset}
          startDate={startDate}
          endDate={endDate}
          onPresetChange={handlePresetChange}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {preset === "custom" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCustomApply}
              disabled={busy}
            >
              <CheckCircle2 className="size-3.5" />
              Apply
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              startTransition(() => {
                void refresh();
              });
            }}
            disabled={busy}
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
            Refresh
          </Button>
          {showAnalytics ? (
            <Select
              aria-label="Export analytics"
              className="h-7 w-auto min-w-[8.5rem]"
              defaultValue=""
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "queue_summary" ||
                  value === "reservation_summary" ||
                  value === "customer_summary"
                ) {
                  downloadExport(value);
                  event.target.value = "";
                }
              }}
            >
              <option value="" disabled>
                Export
              </option>
              {bundle.permissions.canViewQueue ? (
                <option value="queue_summary">Queue CSV</option>
              ) : null}
              {bundle.permissions.canViewReservations ? (
                <option value="reservation_summary">Reservations CSV</option>
              ) : null}
              {bundle.permissions.canViewCustomers ? (
                <option value="customer_summary">Customers CSV</option>
              ) : null}
            </Select>
          ) : null}
          <Badge variant="outline" className="h-6">
            {bundle.range.label}
          </Badge>
        </div>
      </div>

      {loadError ? (
        <ErrorState
          title="Unable to refresh dashboard"
          message={loadError}
          onRetry={() => {
            startTransition(() => {
              void refresh();
            });
          }}
        />
      ) : null}

      {sectionLoading && !bundle.operational ? <SectionSkeleton /> : null}

      {bundle.operational ? (
        <section aria-label="Operational overview">
          {bundle.sectionErrors.operational ? (
            <ErrorState
              title="Operational metrics unavailable"
              message={bundle.sectionErrors.operational.message}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MetricTile
                label="Waiting"
                value={formatCount(bundle.operational.waitingCustomers)}
                hint="In queue now"
                icon={<Users />}
              />
              <MetricTile
                label="Serving"
                value={formatCount(bundle.operational.currentlyServing)}
                hint="Called or seated"
                icon={<ListOrdered />}
              />
              <MetricTile
                label="Tables free"
                value={formatCount(bundle.operational.availableTables)}
                hint="Ready to seat"
                icon={<UtensilsCrossed />}
              />
              <MetricTile
                label="Served today"
                value={formatCount(bundle.operational.servedToday)}
                hint="Completed"
                icon={<CheckCircle2 />}
              />
            </div>
          )}
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {bundle.queue ? (
          <Panel title="Queue mix" icon={<ListOrdered />}>
            {bundle.sectionErrors.queue ? (
              <ErrorState
                title="Queue unavailable"
                message={bundle.sectionErrors.queue.message}
              />
            ) : bundle.queue.total === 0 ? (
              <EmptyState
                title="No queue activity"
                description="Metrics appear once guests join."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <div className="flex items-center gap-3">
                <DonutChart
                  ariaLabel="Queue status mix"
                  summary="Queue entries by status."
                  centerValue={formatCount(bundle.queue.total)}
                  centerLabel="total"
                  size={112}
                  data={queueDonut}
                />
                <LegendList
                  items={queueDonut
                    .filter((item) => item.value > 0)
                    .slice(0, 5)
                    .map((item) => ({
                      key: item.key,
                      label: item.label,
                      value: formatCount(item.value),
                      swatch: item.swatch,
                    }))}
                />
              </div>
            )}
            {bundle.queue.total > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricTile
                  label="Avg wait"
                  value={formatMinutes(bundle.queue.averageWaitMinutes)}
                  hint="Actual"
                  icon={<Clock3 />}
                  className="bg-muted/30"
                />
                <MetricTile
                  label="Avg service"
                  value={formatMinutes(bundle.queue.averageServiceMinutes)}
                  hint="Called → done"
                  icon={<Timer />}
                  className="bg-muted/30"
                />
              </div>
            ) : null}
          </Panel>
        ) : null}

        {bundle.reservations ? (
          <Panel title="Reservations" icon={<CalendarDays />}>
            {bundle.sectionErrors.reservations ? (
              <ErrorState
                title="Reservations unavailable"
                message={bundle.sectionErrors.reservations.message}
              />
            ) : bundle.reservations.total === 0 ? (
              <EmptyState
                title="No reservations"
                description="Bookings will show here."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <DonutChart
                    ariaLabel="Reservation status mix"
                    summary="Reservations by status."
                    centerValue={formatCount(bundle.reservations.total)}
                    centerLabel="booked"
                    size={112}
                    data={reservationDonut}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <MetricTile
                      label="Arrival rate"
                      value={formatPercent(
                        bundle.reservations.arrivalRate.rate,
                      )}
                      icon={<UserRound />}
                      className="bg-muted/30"
                    />
                    <MetricTile
                      label="No-show rate"
                      value={formatPercent(
                        bundle.reservations.noShowRate.rate,
                      )}
                      icon={<Footprints />}
                      className="bg-muted/30"
                    />
                  </div>
                </div>
              </>
            )}
          </Panel>
        ) : null}

        {bundle.tables ? (
          <Panel title="Floor status" icon={<LayoutGrid />}>
            {bundle.sectionErrors.tables ? (
              <ErrorState
                title="Tables unavailable"
                message={bundle.sectionErrors.tables.message}
              />
            ) : bundle.tables.current.total === 0 ? (
              <EmptyState
                title="No tables"
                description="Add tables to see floor status."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatCount(bundle.tables.current.available)}
                      <span className="text-muted-foreground text-sm font-normal">
                        {" "}
                        / {formatCount(bundle.tables.current.total)}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      tables available
                    </p>
                  </div>
                </div>
                <SegmentBar
                  ariaLabel="Table status breakdown"
                  data={tableSegments}
                />
                <LegendList
                  items={tableSegments
                    .filter((item) => item.value > 0)
                    .map((item) => ({
                      key: item.key,
                      label: item.label,
                      value: formatCount(item.value),
                      swatch: item.swatch,
                    }))}
                />
              </div>
            )}
          </Panel>
        ) : null}
      </div>

      {(bundle.walkIns && bundle.walkIns.total > 0) ||
      (bundle.customers && bundle.customers.totalServed > 0) ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {bundle.walkIns ? (
            <>
              <MetricTile
                label="Walk-ins"
                value={formatCount(bundle.walkIns.total)}
                hint={`${formatCount(bundle.walkIns.addedToQueue)} queued · ${formatCount(bundle.walkIns.seatedDirectly)} seated`}
                icon={<Footprints />}
              />
              <MetricTile
                label="Walk-in wait"
                value={formatMinutes(bundle.walkIns.averageWaitMinutes)}
                hint={`Done ${formatPercent(bundle.walkIns.completionRate.rate)}`}
                icon={<Clock3 />}
              />
            </>
          ) : null}
          {bundle.customers ? (
            <>
              <MetricTile
                label="Served"
                value={formatCount(bundle.customers.totalServed)}
                hint={`${formatCount(bundle.customers.newCustomers)} new · ${formatCount(bundle.customers.returningCustomers)} return`}
                icon={<Users />}
              />
              <MetricTile
                label="Party size"
                value={
                  bundle.customers.averagePartySize === null
                    ? "—"
                    : String(
                        roundMinutes(bundle.customers.averagePartySize, 1),
                      )
                }
                hint="Average guests"
                icon={<Users />}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {deep && showAnalytics ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="Queue volume"
              icon={<TrendingUp />}
              action={
                <span className="text-muted-foreground text-[11px]">
                  {bundle.range.grouping === "hour" ? "Hourly" : "Daily"}
                </span>
              }
            >
              <SimpleBarChart
                compact
                ariaLabel="Queue volume chart"
                summary="Queue join volume over the selected range."
                data={bundle.queueVolume.map((point) => ({
                  key: point.key,
                  label: point.label,
                  value: point.count,
                }))}
                emptyMessage="No volume yet."
              />
            </Panel>

            <Panel title="Actual wait trend" icon={<Clock3 />}>
              <SimpleLineChart
                compact
                ariaLabel="Wait time trend chart"
                summary="Average actual wait time over the selected range."
                data={(bundle.waitTime?.trend ?? []).map((point) => ({
                  key: point.key,
                  label: point.label,
                  value: point.averageWaitMinutes ?? 0,
                }))}
                valueFormatter={(value) => formatMinutes(value)}
                emptyMessage="Not enough called guests."
              />
            </Panel>

            <Panel title="Service time trend" icon={<Timer />}>
              <SimpleLineChart
                compact
                ariaLabel="Service time trend chart"
                summary="Average service time over the selected range."
                data={(bundle.serviceTime?.trend ?? []).map((point) => ({
                  key: point.key,
                  label: point.label,
                  value: point.averageWaitMinutes ?? 0,
                }))}
                valueFormatter={(value) => formatMinutes(value)}
                emptyMessage="Not enough completions."
              />
            </Panel>

            <Panel title="Peak hours" icon={<TrendingUp />}>
              {bundle.peakHours.length === 0 ? (
                <EmptyState
                  title="No peaks yet"
                  description="Peaks appear after queue joins."
                  className="border-0 bg-transparent py-6"
                />
              ) : (
                <div className="space-y-2.5">
                  {bundle.peakHours.slice(0, 5).map((row) => (
                    <HorizontalMeter
                      key={row.hour}
                      label={row.label}
                      value={row.count}
                      max={peakMax}
                      display={`${formatCount(row.count)} · ${formatMinutes(row.averageWaitMinutes)}`}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {bundle.customers && bundle.customers.byDay.length > 0 ? (
              <Panel
                title="Customers by day"
                icon={<Users />}
                className="lg:col-span-2"
              >
                <SimpleBarChart
                  compact
                  ariaLabel="Customers by day chart"
                  summary={`Daily customer counts from ${bundle.range.startDate} to ${bundle.range.endDate}.`}
                  data={bundle.customers.byDay.map((point) => ({
                    key: point.key,
                    label: point.label,
                    value: point.count,
                  }))}
                />
              </Panel>
            ) : null}

            {bundle.partySize.length > 0 ? (
              <Panel title="Party size" icon={<Users />}>
                <div className="flex items-center gap-3">
                  <DonutChart
                    ariaLabel="Party size mix"
                    summary="Party size distribution."
                    centerValue={formatCount(
                      bundle.partySize.reduce(
                        (sum, bucket) => sum + bucket.count,
                        0,
                      ),
                    )}
                    centerLabel="parties"
                    size={104}
                    data={bundle.partySize.map((bucket, index) => ({
                      key: bucket.key,
                      label: bucket.label,
                      value: bucket.count,
                      colorClass: [
                        "stroke-primary",
                        "stroke-chart-2",
                        "stroke-chart-3",
                        "stroke-chart-4",
                      ][index % 4],
                    }))}
                  />
                  <LegendList
                    items={bundle.partySize.map((bucket, index) => ({
                      key: bucket.key,
                      label: bucket.label,
                      value: formatCount(bucket.count),
                      swatch: [
                        "bg-primary",
                        "bg-chart-2",
                        "bg-chart-3",
                        "bg-chart-4",
                      ][index % 4]!,
                    }))}
                  />
                </div>
              </Panel>
            ) : null}
          </div>

          {bundle.waitTime ? (
            <div className="grid grid-cols-3 gap-2">
              <MetricTile
                label="Median wait"
                value={formatMinutes(bundle.waitTime.medianMinutes)}
                hint={`${formatCount(bundle.waitTime.sampleSize)} samples`}
                icon={<Clock3 />}
              />
              <MetricTile
                label="Max wait"
                value={formatMinutes(bundle.waitTime.maximumMinutes)}
                icon={<Timer />}
              />
              <MetricTile
                label="Max service"
                value={formatMinutes(
                  bundle.serviceTime?.maximumMinutes ?? null,
                )}
                icon={<Timer />}
              />
            </div>
          ) : null}

          {bundle.reservations && bundle.reservations.total > 0 ? (
            <Panel title="Reservation volume" icon={<CalendarDays />}>
              <SimpleBarChart
                compact
                ariaLabel="Reservation volume chart"
                summary="Reservation counts by day."
                data={bundle.reservations.volume.map((point) => ({
                  key: point.key,
                  label: point.label,
                  value: point.count,
                }))}
              />
            </Panel>
          ) : null}

          {comparableBranches.length > 1 ? (
            <Panel title="Branch comparison" icon={<GitCompareArrows />}>
              <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5">
                {comparableBranches.map((branch) => {
                  const checked = compareBranchIds.includes(branch.id);
                  return (
                    <label
                      key={branch.id}
                      htmlFor={`compare-${branch.id}`}
                      className="hover:bg-muted/40 flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs"
                    >
                      <Checkbox
                        id={`compare-${branch.id}`}
                        checked={checked}
                        disabled={compareLoading}
                        onCheckedChange={() =>
                          toggleCompareBranch(branch.id)
                        }
                      />
                      <span>{branch.name}</span>
                    </label>
                  );
                })}
              </div>
              {bundle.sectionErrors.branchComparison ? (
                <ErrorState
                  title="Comparison unavailable"
                  message={bundle.sectionErrors.branchComparison.message}
                />
              ) : compareBranchIds.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Select branches to compare factual metrics.
                </p>
              ) : (
                <div className="max-w-full overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <caption className="sr-only">
                      Branch comparison metrics
                    </caption>
                    <thead>
                      <tr className="border-border text-muted-foreground border-b">
                        <th className="px-2 py-1.5 font-medium">Branch</th>
                        <th className="px-2 py-1.5 font-medium">Served</th>
                        <th className="px-2 py-1.5 font-medium">Queue</th>
                        <th className="px-2 py-1.5 font-medium">Wait</th>
                        <th className="px-2 py-1.5 font-medium">Res.</th>
                        <th className="px-2 py-1.5 font-medium">No-show</th>
                        <th className="px-2 py-1.5 font-medium">Service</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareLoading
                        ? compareBranchIds.map((branchId) => {
                            const name =
                              comparableBranches.find(
                                (branch) => branch.id === branchId,
                              )?.name ?? "Branch";
                            return (
                              <tr
                                key={`skeleton-${branchId}`}
                                className="border-border border-b last:border-0"
                                aria-busy="true"
                              >
                                <td className="px-2 py-2 font-medium">
                                  <span className="sr-only">
                                    Loading {name}
                                  </span>
                                  <Skeleton className="h-3.5 w-24" />
                                </td>
                                {Array.from({ length: 6 }).map((_, index) => (
                                  <td
                                    key={`${branchId}-cell-${index}`}
                                    className="px-2 py-2"
                                  >
                                    <Skeleton className="h-3.5 w-10" />
                                  </td>
                                ))}
                              </tr>
                            );
                          })
                        : null}
                      {!compareLoading &&
                      (!bundle.branchComparison ||
                        bundle.branchComparison.length === 0) ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-muted-foreground px-2 py-3 text-xs"
                          >
                            No activity for the selected branches in this range.
                          </td>
                        </tr>
                      ) : null}
                      {!compareLoading
                        ? bundle.branchComparison?.map((row) => (
                            <tr
                              key={row.branchId}
                              className="border-border border-b last:border-0"
                            >
                              <td className="px-2 py-1.5 font-medium">
                                {row.branchName}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums">
                                {formatCount(row.customersServed)}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums">
                                {formatCount(row.queueVolume)}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums">
                                {formatMinutes(row.averageWaitMinutes)}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums">
                                {formatCount(row.reservations)}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums">
                                {formatCount(row.noShows)}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums">
                                {formatMinutes(row.averageServiceMinutes)}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ) : null}
        </>
      ) : null}

      {!showAnalytics && mode === "analytics" ? (
        <ErrorState
          title="Analytics access required"
          message="Operational metrics stay on Overview. Ask an admin for analytics access."
        />
      ) : null}

      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Download className="size-3" aria-hidden />
        CSV exports are audited and exclude guest contact details.
      </p>
    </div>
  );
}
