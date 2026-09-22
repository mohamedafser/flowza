"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Pagination } from "@/components/common/Pagination";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/api/admin-client";
import { scheduleAdminFetchStart } from "@/lib/admin/schedule-fetch";
import { ADMIN_PAYMENTS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { AdminPaymentListItem } from "@/services/admin/admin-payments.service";
import type { AdminRevenueAnalytics } from "@/services/admin/admin-payments.service";
import type { PageResult } from "@/services/admin/admin-client";
import { ADMIN_RESTAURANTS_PATH } from "@/lib/auth/paths";

type Filters = {
  q: string;
  status: string;
  range: string;
};

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function AdminPaymentsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);
  const analyticsId = useRef(0);

  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "ALL",
    range: searchParams.get("range") ?? "last_30_days",
  });
  const debouncedQ = useDebounced(filters.q);
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [result, setResult] =
    useState<PageResult<AdminPaymentListItem> | null>(null);
  const [analytics, setAnalytics] = useState<AdminRevenueAnalytics | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const syncUrl = useCallback(
    (next: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...next };
      if (merged.q) params.set("q", merged.q);
      else params.delete("q");
      if (merged.status && merged.status !== "ALL")
        params.set("status", merged.status);
      else params.delete("status");
      if (merged.range) params.set("range", merged.range);
      params.set("page", String(next.page ?? 1));
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [filters, pathname, router, searchParams],
  );

  useEffect(() => {
    const id = ++analyticsId.current;
    const cancelStart = scheduleAdminFetchStart(() => {
      if (id !== analyticsId.current) return;
      setAnalyticsLoading(true);
      setAnalyticsError(null);
    });
    const params = new URLSearchParams();
    params.set("analytics", "1");
    params.set("range", filters.range);
    void adminFetch<AdminRevenueAnalytics>(
      `/api/admin/payments?${params.toString()}`,
    ).then((response) => {
      if (id !== analyticsId.current) return;
      setAnalyticsLoading(false);
      if (!response.ok || !response.data) {
        setAnalyticsError(response.message ?? "Unable to load analytics.");
        setAnalytics(null);
        return;
      }
      setAnalytics(response.data);
    });
    return () => cancelStart();
  }, [filters.range]);

  useEffect(() => {
    const id = ++requestId.current;
    const cancelStart = scheduleAdminFetchStart(() => {
      if (id !== requestId.current) return;
      setLoading(true);
      setError(null);
    });
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "20");
    if (debouncedQ) params.set("q", debouncedQ);
    if (filters.status !== "ALL") params.set("status", filters.status);

    void adminFetch<PageResult<AdminPaymentListItem>>(
      `/api/admin/payments?${params.toString()}`,
    ).then((response) => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load payments.");
        setResult(null);
        return;
      }
      setResult(response.data);
    });
    return () => cancelStart();
  }, [debouncedQ, filters.status, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Platform payment history and revenue analytics."
        breadcrumbs={ADMIN_PAYMENTS_BREADCRUMBS}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="pay-range">Analytics range</Label>
          <Select
            id="pay-range"
            aria-label="Revenue analytics range"
            value={filters.range}
            onChange={(event) => {
              const range = event.target.value;
              setFilters((prev) => ({ ...prev, range }));
              syncUrl({ range, page: 1 });
            }}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
          </Select>
        </div>
      </div>

      {analyticsLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : analyticsError ? (
        <ErrorState title="Analytics unavailable" message={analyticsError} />
      ) : analytics ? (
        <section
          className="border-border grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Revenue analytics"
        >
          <div>
            <p className="text-muted-foreground text-xs">Revenue</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(analytics.revenue, analytics.currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Successful payments</p>
            <p className="text-lg font-semibold tabular-nums">
              {analytics.successfulPayments}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Failed / pending</p>
            <p className="text-lg font-semibold tabular-nums">
              {analytics.failedPayments} / {analytics.pendingPayments}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Active / trialing subs</p>
            <p className="text-lg font-semibold tabular-nums">
              {analytics.activeSubscriptions} / {analytics.trialingSubscriptions}
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="pay-search">Search</Label>
          <Input
            id="pay-search"
            value={filters.q}
            placeholder="Restaurant, payment ID, or UUID"
            onChange={(event) => {
              const q = event.target.value;
              setFilters((prev) => ({ ...prev, q }));
              syncUrl({ q, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-status">Status</Label>
          <Select
            id="pay-status"
            aria-label="Filter by payment status"
            value={filters.status}
            onChange={(event) => {
              const status = event.target.value;
              setFilters((prev) => ({ ...prev, status }));
              syncUrl({ status, page: 1 });
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="REFUNDED">REFUNDED</option>
          </Select>
        </div>
      </div>

      {loading || pending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load payments" message={error} />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No payments found"
          description="Try adjusting search or filters."
        />
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Restaurant</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Provider payment ID</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`${ADMIN_RESTAURANTS_PATH}/${item.restaurantId}`}
                        className="hover:underline"
                      >
                        {item.restaurantName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(item.amount, item.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">{item.provider ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs break-all">
                      {item.providerPaymentId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            onPageChange={(nextPage) => syncUrl({ page: nextPage })}
          />
        </>
      )}
    </div>
  );
}
