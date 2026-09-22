"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Pagination } from "@/components/common/Pagination";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/api/admin-client";
import { scheduleAdminFetchStart } from "@/lib/admin/schedule-fetch";
import { ADMIN_RESTAURANTS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { AdminRestaurantListItem } from "@/services/admin/admin-restaurants.service";
import type { PageResult } from "@/services/admin/admin-client";
import { toast } from "sonner";

type Filters = {
  q: string;
  status: string;
  plan: string;
  subscriptionStatus: string;
};

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function AdminRestaurantsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get("q") ?? "",
    status: searchParams.get("status") ?? "ALL",
    plan: searchParams.get("plan") ?? "",
    subscriptionStatus: searchParams.get("subscriptionStatus") ?? "ALL",
  });
  const debouncedQ = useDebounced(filters.q);
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [result, setResult] =
    useState<PageResult<AdminRestaurantListItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{
    id: string;
    name: string;
    status: "SUSPENDED" | "ACTIVE" | "INACTIVE";
  } | null>(null);
  const [mutating, setMutating] = useState(false);

  const syncUrl = useCallback(
    (next: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...next };
      if (merged.q) params.set("q", merged.q);
      else params.delete("q");
      if (merged.status && merged.status !== "ALL")
        params.set("status", merged.status);
      else params.delete("status");
      if (merged.plan) params.set("plan", merged.plan);
      else params.delete("plan");
      if (merged.subscriptionStatus && merged.subscriptionStatus !== "ALL")
        params.set("subscriptionStatus", merged.subscriptionStatus);
      else params.delete("subscriptionStatus");
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
    if (filters.plan) params.set("plan", filters.plan);
    if (filters.subscriptionStatus !== "ALL")
      params.set("subscriptionStatus", filters.subscriptionStatus);

    void adminFetch<PageResult<AdminRestaurantListItem>>(
      `/api/admin/restaurants?${params.toString()}`,
    ).then((response) => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load restaurants.");
        setResult(null);
        return;
      }
      setResult(response.data);
    });
    return () => cancelStart();
  }, [
    debouncedQ,
    filters.plan,
    filters.status,
    filters.subscriptionStatus,
    page,
  ]);

  async function applyStatus() {
    if (!confirm) return;
    setMutating(true);
    const response = await adminFetch(`/api/admin/restaurants/${confirm.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: confirm.status }),
    });
    setMutating(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to update status.");
      return;
    }
    toast.success(
      confirm.status === "ACTIVE"
        ? "Restaurant reactivated."
        : "Restaurant status updated.",
    );
    setConfirm(null);
    setResult((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              item.id === confirm.id
                ? { ...item, status: confirm.status }
                : item,
            ),
          }
        : prev,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        description="Search, filter, and manage platform restaurants."
        breadcrumbs={ADMIN_RESTAURANTS_BREADCRUMBS}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="restaurant-search">Search</Label>
          <Input
            id="restaurant-search"
            value={filters.q}
            placeholder="Name, owner, email, branch, or ID"
            onChange={(event) => {
              const q = event.target.value;
              setFilters((prev) => ({ ...prev, q }));
              syncUrl({ q, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-status">Status</Label>
          <Select
            id="restaurant-status"
            aria-label="Filter by status"
            value={filters.status}
            onChange={(event) => {
              const status = event.target.value;
              setFilters((prev) => ({ ...prev, status }));
              syncUrl({ status, page: 1 });
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-sub">Subscription</Label>
          <Select
            id="restaurant-sub"
            aria-label="Filter by subscription status"
            value={filters.subscriptionStatus}
            onChange={(event) => {
              const subscriptionStatus = event.target.value;
              setFilters((prev) => ({ ...prev, subscriptionStatus }));
              syncUrl({ subscriptionStatus, page: 1 });
            }}
          >
            <option value="ALL">All subscriptions</option>
            <option value="TRIALING">TRIALING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAST_DUE">PAST_DUE</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="NONE">NONE</option>
          </Select>
        </div>
      </div>

      {loading || pending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load restaurants" message={error} />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No restaurants found"
          description="Try adjusting search or filters."
        />
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Restaurant</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Branches</th>
                  <th className="px-3 py-2 font-medium">Users</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Subscription</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/restaurants/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div>{item.ownerName ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        {item.ownerEmail ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{item.branchCount}</td>
                    <td className="px-3 py-2 tabular-nums">{item.memberCount}</td>
                    <td className="px-3 py-2">{item.planCode ?? "—"}</td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.subscriptionStatus} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {item.status === "ACTIVE" ? (
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() =>
                              setConfirm({
                                id: item.id,
                                name: item.name,
                                status: "SUSPENDED",
                              })
                            }
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            onClick={() =>
                              setConfirm({
                                id: item.id,
                                name: item.name,
                                status: "ACTIVE",
                              })
                            }
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
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

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.status === "SUSPENDED"
            ? "Suspend restaurant?"
            : "Reactivate restaurant?"
        }
        description={
          confirm?.status === "SUSPENDED"
            ? `This will prevent users from accessing ${confirm.name}. Existing data remains intact.`
            : `This will restore access to ${confirm?.name ?? "this restaurant"}.`
        }
        confirmLabel={
          confirm?.status === "SUSPENDED"
            ? "Suspend restaurant"
            : "Reactivate restaurant"
        }
        destructive={confirm?.status === "SUSPENDED"}
        loading={mutating}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}
