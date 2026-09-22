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
import { ADMIN_SUBSCRIPTIONS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { AdminSubscriptionListItem } from "@/services/admin/admin-subscriptions.service";
import type { PageResult } from "@/services/admin/admin-client";

type Filters = {
  q: string;
  status: string;
  billingCycle: string;
  plan: string;
};

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  const code = currency ?? "INR";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

export function AdminSubscriptionsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "ALL",
    billingCycle: searchParams.get("billingCycle") ?? "ALL",
    plan: searchParams.get("plan") ?? "",
  });
  const debouncedQ = useDebounced(filters.q);
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [result, setResult] =
    useState<PageResult<AdminSubscriptionListItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUrl = useCallback(
    (next: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...next };
      if (merged.q) params.set("q", merged.q);
      else params.delete("q");
      if (merged.status && merged.status !== "ALL")
        params.set("status", merged.status);
      else params.delete("status");
      if (merged.billingCycle && merged.billingCycle !== "ALL")
        params.set("billingCycle", merged.billingCycle);
      else params.delete("billingCycle");
      if (merged.plan) params.set("plan", merged.plan);
      else params.delete("plan");
      params.set("page", String(next.page ?? 1));
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [filters, pathname, router, searchParams],
  );

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
    if (filters.billingCycle !== "ALL")
      params.set("billingCycle", filters.billingCycle);
    if (filters.plan.trim()) params.set("plan", filters.plan.trim());

    void adminFetch<PageResult<AdminSubscriptionListItem>>(
      `/api/admin/subscriptions?${params.toString()}`,
    ).then((response) => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load subscriptions.");
        setResult(null);
        return;
      }
      setResult(response.data);
    });
    return () => cancelStart();
  }, [debouncedQ, filters.billingCycle, filters.plan, filters.status, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Review billing status and manage restaurant subscriptions."
        breadcrumbs={ADMIN_SUBSCRIPTIONS_BREADCRUMBS}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="sub-search">Search restaurant</Label>
          <Input
            id="sub-search"
            value={filters.q}
            placeholder="Restaurant name"
            onChange={(event) => {
              const q = event.target.value;
              setFilters((prev) => ({ ...prev, q }));
              syncUrl({ q, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-status">Status</Label>
          <Select
            id="sub-status"
            aria-label="Filter by subscription status"
            value={filters.status}
            onChange={(event) => {
              const status = event.target.value;
              setFilters((prev) => ({ ...prev, status }));
              syncUrl({ status, page: 1 });
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="TRIALING">TRIALING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="EXPIRED">EXPIRED</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-cycle">Billing cycle</Label>
          <Select
            id="sub-cycle"
            aria-label="Filter by billing cycle"
            value={filters.billingCycle}
            onChange={(event) => {
              const billingCycle = event.target.value;
              setFilters((prev) => ({ ...prev, billingCycle }));
              syncUrl({ billingCycle, page: 1 });
            }}
          >
            <option value="ALL">All cycles</option>
            <option value="MONTHLY">MONTHLY</option>
            <option value="YEARLY">YEARLY</option>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="sub-plan">Plan code</Label>
          <Input
            id="sub-plan"
            value={filters.plan}
            placeholder="e.g. STARTER"
            onChange={(event) => {
              const plan = event.target.value;
              setFilters((prev) => ({ ...prev, plan }));
              syncUrl({ plan, page: 1 });
            }}
          />
        </div>
      </div>

      {loading || pending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load subscriptions" message={error} />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No subscriptions found"
          description="Try adjusting search or filters."
        />
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Restaurant</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Cycle</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Period end</th>
                  <th className="px-3 py-2 font-medium">Trial end</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/subscriptions/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.restaurantName}
                      </Link>
                      {item.cancelAtPeriodEnd ? (
                        <div className="text-muted-foreground text-xs">
                          Cancels at period end
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{item.planCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">{item.billingCycle}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(item.amount, item.currency)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.currentPeriodEnd
                        ? new Date(item.currentPeriodEnd).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.trialEnd
                        ? new Date(item.trialEnd).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
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
