import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { getAdminDashboardMetrics } from "@/services/admin/admin-dashboard.service";
import { adminBreadcrumbs } from "@/lib/navigation/breadcrumbs";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border-border bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      ) : null}
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export default async function AdminOverviewPage() {
  const metrics = await getAdminDashboardMetrics();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform overview"
        description="Operational metrics across restaurants, users, and billing."
        breadcrumbs={adminBreadcrumbs()}
      />

      <section className="space-y-3" aria-labelledby="restaurants-metrics">
        <div className="flex items-center gap-2">
          <h2 id="restaurants-metrics" className="text-sm font-semibold">
            Restaurants
          </h2>
          <Badge variant="secondary">{metrics.restaurants.total} total</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active" value={metrics.restaurants.active} />
          <MetricCard label="Inactive" value={metrics.restaurants.inactive} />
          <MetricCard label="Suspended" value={metrics.restaurants.suspended} />
          <MetricCard
            label="Created (30d)"
            value={metrics.restaurants.createdLast30Days}
            hint={`${metrics.restaurants.createdLast7Days} in last 7 days`}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="users-metrics">
        <h2 id="users-metrics" className="text-sm font-semibold">
          Users
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total" value={metrics.users.total} />
          <MetricCard label="Active" value={metrics.users.active} />
          <MetricCard label="Disabled" value={metrics.users.disabled} />
          <MetricCard label="Verified (scanned)" value={metrics.users.verified} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="subs-metrics">
        <h2 id="subs-metrics" className="text-sm font-semibold">
          Subscriptions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Active" value={metrics.subscriptions.active} />
          <MetricCard label="Trialing" value={metrics.subscriptions.trialing} />
          <MetricCard label="Past due" value={metrics.subscriptions.pastDue} />
          <MetricCard
            label="Cancelled"
            value={metrics.subscriptions.cancelled}
          />
          <MetricCard label="Expired" value={metrics.subscriptions.expired} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="revenue-metrics">
        <h2 id="revenue-metrics" className="text-sm font-semibold">
          Revenue (this month)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Current period"
            value={formatMoney(
              metrics.revenue.currentPeriodAmount,
              metrics.revenue.currency,
            )}
          />
          <MetricCard
            label="Previous period"
            value={formatMoney(
              metrics.revenue.previousPeriodAmount,
              metrics.revenue.currency,
            )}
          />
          <MetricCard
            label="Successful payments"
            value={metrics.revenue.successfulPayments}
          />
          <MetricCard
            label="Failed payments"
            value={metrics.revenue.failedPayments}
          />
        </div>
      </section>
    </div>
  );
}
