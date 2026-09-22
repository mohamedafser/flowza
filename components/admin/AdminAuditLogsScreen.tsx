"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Pagination } from "@/components/common/Pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/api/admin-client";
import { scheduleAdminFetchStart } from "@/lib/admin/schedule-fetch";
import { ADMIN_AUDIT_LOGS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { AdminAuditListItem } from "@/services/admin/admin-audit.service";
import type { PageResult } from "@/services/admin/admin-client";
import {
  ADMIN_RESTAURANTS_PATH,
  ADMIN_USERS_PATH,
} from "@/lib/auth/paths";

type Filters = {
  q: string;
  action: string;
  restaurantId: string;
  actorId: string;
};

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function AdminAuditLogsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get("q") ?? "",
    action: searchParams.get("action") ?? "",
    restaurantId: searchParams.get("restaurantId") ?? "",
    actorId: searchParams.get("actorId") ?? "",
  });
  const debouncedQ = useDebounced(filters.q);
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [result, setResult] = useState<PageResult<AdminAuditListItem> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUrl = useCallback(
    (next: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...next };
      if (merged.q) params.set("q", merged.q);
      else params.delete("q");
      if (merged.action.trim()) params.set("action", merged.action.trim());
      else params.delete("action");
      if (merged.restaurantId.trim())
        params.set("restaurantId", merged.restaurantId.trim());
      else params.delete("restaurantId");
      if (merged.actorId.trim()) params.set("actorId", merged.actorId.trim());
      else params.delete("actorId");
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
    if (filters.action.trim()) params.set("action", filters.action.trim());
    if (filters.restaurantId.trim())
      params.set("restaurantId", filters.restaurantId.trim());
    if (filters.actorId.trim()) params.set("actorId", filters.actorId.trim());

    void adminFetch<PageResult<AdminAuditListItem>>(
      `/api/admin/audit-logs?${params.toString()}`,
    ).then((response) => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load audit logs.");
        setResult(null);
        return;
      }
      setResult(response.data);
    });
    return () => cancelStart();
  }, [
    debouncedQ,
    filters.action,
    filters.actorId,
    filters.restaurantId,
    page,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Platform and restaurant activity recorded for compliance and support."
        breadcrumbs={ADMIN_AUDIT_LOGS_BREADCRUMBS}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="audit-search">Search</Label>
          <Input
            id="audit-search"
            value={filters.q}
            placeholder="Action, entity type, or entity ID"
            onChange={(event) => {
              const q = event.target.value;
              setFilters((prev) => ({ ...prev, q }));
              syncUrl({ q, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <Input
            id="audit-action"
            value={filters.action}
            placeholder="e.g. USER_DISABLED"
            onChange={(event) => {
              const action = event.target.value;
              setFilters((prev) => ({ ...prev, action }));
              syncUrl({ action, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-restaurant">Restaurant ID</Label>
          <Input
            id="audit-restaurant"
            value={filters.restaurantId}
            placeholder="UUID"
            onChange={(event) => {
              const restaurantId = event.target.value;
              setFilters((prev) => ({ ...prev, restaurantId }));
              syncUrl({ restaurantId, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="audit-actor">Actor user ID</Label>
          <Input
            id="audit-actor"
            value={filters.actorId}
            placeholder="UUID"
            onChange={(event) => {
              const actorId = event.target.value;
              setFilters((prev) => ({ ...prev, actorId }));
              syncUrl({ actorId, page: 1 });
            }}
          />
        </div>
      </div>

      {loading || pending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load audit logs" message={error} />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No audit entries found"
          description="Try adjusting search or filters."
        />
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">Restaurant</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{item.action}</td>
                    <td className="px-3 py-2">
                      <div>{item.entityType}</div>
                      {item.entityId ? (
                        <div className="text-muted-foreground font-mono text-xs break-all">
                          {item.entityId}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {item.restaurantId ? (
                        <Link
                          href={`${ADMIN_RESTAURANTS_PATH}/${item.restaurantId}`}
                          className="hover:underline"
                        >
                          {item.restaurantName ?? item.restaurantId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.actorId ? (
                        <Link
                          href={`${ADMIN_USERS_PATH}/${item.actorId}`}
                          className="hover:underline"
                        >
                          {item.actorName ?? item.actorId}
                        </Link>
                      ) : (
                        "—"
                      )}
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
