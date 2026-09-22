import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeaderSkeleton({
  withActions = false,
  className,
}: {
  withActions?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      <Skeleton className="h-3 w-40" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        {withActions ? <Skeleton className="h-8 w-28" /> : null}
      </div>
    </div>
  );
}

export function MetricTileSkeleton() {
  return (
    <div className="border-border bg-card rounded-lg border px-3 py-2.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-6 w-12" />
      <Skeleton className="mt-1.5 h-3 w-20" />
    </div>
  );
}

export function MetricsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <MetricTileSkeleton key={index} />
      ))}
    </div>
  );
}

export function PanelSkeleton({
  className,
  heightClass = "h-36",
}: {
  className?: string;
  heightClass?: string;
}) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <CardHeader className="px-3 pt-0 pb-0">
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <Skeleton className={cn("w-full rounded-md", heightClass)} />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card overflow-hidden rounded-xl border",
        className,
      )}
      role="status"
      aria-label="Loading table"
    >
      <div className="border-border flex gap-3 border-b px-3 py-2.5">
        {Array.from({ length: cols }).map((_, index) => (
          <Skeleton
            key={`head-${index}`}
            className={cn("h-3", index === 0 ? "w-28" : "w-16")}
          />
        ))}
      </div>
      <div className="divide-border divide-y">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={`row-${row}`} className="flex items-center gap-3 px-3 py-3">
            {Array.from({ length: cols }).map((_, col) => (
              <Skeleton
                key={`cell-${row}-${col}`}
                className={cn("h-3.5", col === 0 ? "w-32" : "w-14")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton({
  label = "Loading…",
  withFilters = true,
}: {
  label?: string;
  withFilters?: boolean;
}) {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      <PageHeaderSkeleton withActions />
      {withFilters ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      ) : null}
      <MetricsRowSkeleton count={4} />
      <TableSkeleton rows={7} cols={5} />
    </div>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  if (fields <= 0) {
    return null;
  }

  return (
    <div className="border-border bg-card max-w-xl space-y-4 rounded-xl border p-4">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading settings">
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-card space-y-2 rounded-xl border p-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <PageHeaderSkeleton withActions />
      <div className="border-border bg-card/60 flex flex-wrap gap-2 rounded-xl border p-3">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-16" />
      </div>
      <MetricsRowSkeleton count={4} />
      <div className="grid gap-3 lg:grid-cols-3">
        <PanelSkeleton heightClass="h-28" />
        <PanelSkeleton heightClass="h-28" />
        <PanelSkeleton heightClass="h-28" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  );
}

export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div
      className="auth-card w-full"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="auth-card-inner space-y-5 p-6 sm:p-7">
        <div className="space-y-3">
          <Skeleton className="size-11 rounded-[0.9rem]" />
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({ length: fields }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        <div className="border-border/60 border-t pt-4">
          <Skeleton className="mx-auto h-4 w-44" />
        </div>
      </div>
    </div>
  );
}
