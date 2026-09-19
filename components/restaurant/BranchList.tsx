"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  listBranchesRequest,
  setBranchStatusRequest,
  type BranchListApiData,
} from "@/lib/api/branches-client";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BranchListFilters } from "@/components/restaurant/BranchListFilters";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/context/restaurant";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import {
  BRANCH_PAGE_SIZE_OPTIONS,
  DEFAULT_BRANCH_PAGE_SIZE,
  parseBranchListQuery,
  type BranchListQuery,
} from "@/lib/validations/branch";

type BranchListProps = {
  canManage: boolean;
};

function queryFromSearchParams(): BranchListQuery {
  if (typeof window === "undefined") {
    return parseBranchListQuery({});
  }
  return parseBranchListQuery(
    Object.fromEntries(new URLSearchParams(window.location.search).entries()),
  );
}

function syncUrl(query: BranchListQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (query.pageSize !== DEFAULT_BRANCH_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  const next = qs ? `${SETTINGS_BRANCHES_PATH}?${qs}` : SETTINGS_BRANCHES_PATH;
  window.history.replaceState(null, "", next);
}

/** FE only uses search + status; drop other list filters from client state. */
function toFeQuery(query: BranchListQuery): BranchListQuery {
  return {
    q: query.q,
    city: undefined,
    country: undefined,
    status: query.status,
    sort: "name",
    order: "asc",
    page: query.page,
    pageSize: query.pageSize,
  };
}

function toListResult(data: BranchListApiData): {
  items: Branch[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  return {
    items: data.items,
    total: data.pagination.total,
    page: data.pagination.page,
    pageSize: data.pagination.pageSize,
    totalPages: data.pagination.totalPages,
  };
}

export function BranchList({ canManage }: BranchListProps) {
  const [query, setQuery] = useState<BranchListQuery>(() =>
    parseBranchListQuery({}),
  );
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<ReturnType<typeof toListResult> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmBranch, setConfirmBranch] = useState<Branch | null>(null);

  const load = useCallback(async (nextQuery: BranchListQuery) => {
    setError(null);
    const feQuery = toFeQuery(nextQuery);
    const response = await listBranchesRequest(feQuery);
    if (!response.ok || !response.data) {
      setError(response.message ?? "Unable to load branches.");
      setLoading(false);
      return;
    }
    const next = toFeQuery({
      q: response.data.filters.q,
      city: undefined,
      country: undefined,
      status: response.data.filters.status,
      sort: "name",
      order: "asc",
      page: response.data.pagination.page,
      pageSize: response.data.pagination.pageSize,
    });
    setResult(toListResult(response.data));
    setQuery(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const initial = toFeQuery(queryFromSearchParams());
      const response = await listBranchesRequest(initial);
      if (cancelled) return;

      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load branches.");
        setLoading(false);
        return;
      }

      const next = toFeQuery({
        q: response.data.filters.q,
        city: undefined,
        country: undefined,
        status: response.data.filters.status,
        sort: "name",
        order: "asc",
        page: response.data.pagination.page,
        pageSize: response.data.pagination.pageSize,
      });
      setResult(toListResult(response.data));
      setQuery(next);
      setSearch(next.q ?? "");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyQuery = useCallback(
    (patch: Partial<BranchListQuery>) => {
      const next = toFeQuery(
        parseBranchListQuery({
          q: "q" in patch ? patch.q : query.q,
          status: patch.status ?? query.status,
          page: String(patch.page ?? query.page),
          pageSize: String(patch.pageSize ?? query.pageSize),
        }),
      );
      syncUrl(next);
      setQuery(next);
      setLoading(true);
      void load(next);
    },
    [query, load],
  );

  useEffect(() => {
    const trimmed = search.trim();
    const nextQ = trimmed || undefined;
    if (nextQ === (query.q || undefined)) {
      return;
    }

    const timer = window.setTimeout(() => {
      applyQuery({ q: nextQ, page: 1 });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, query.q, applyQuery]);

  const onToggle = (branch: Branch) => {
    if (branch.is_active) {
      setConfirmBranch(branch);
      return;
    }
    startTransition(async () => {
      const actionResult = await setBranchStatusRequest(branch.id, true);
      if (!actionResult.ok) {
        toast.error(actionResult.message ?? "Unable to activate branch.");
        return;
      }
      toast.success("Branch activated.");
      void load(query);
    });
  };

  const confirmDeactivate = () => {
    if (!confirmBranch) return;
    const branchId = confirmBranch.id;
    startTransition(async () => {
      const actionResult = await setBranchStatusRequest(branchId, false);
      setConfirmBranch(null);
      if (!actionResult.ok) {
        toast.error(actionResult.message ?? "Unable to deactivate branch.");
        return;
      }
      toast.success("Branch deactivated.");
      void load(query);
    });
  };

  const hasFilters = Boolean(query.q) || query.status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <BranchListFilters
          search={search}
          status={query.status}
          pending={loading || pending}
          onSearchChange={setSearch}
          onStatusChange={(status) => applyQuery({ status, page: 1 })}
        />
        {canManage ? (
          <Button
            render={<Link href="/settings/branches/new" />}
            nativeButton={false}
            className="shrink-0"
          >
            Create branch
          </Button>
        ) : null}
      </div>

      {loading && !result ? (
        <LoadingState label="Loading branches" rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load branches"
          message={error}
          onRetry={() => void load(query)}
        />
      ) : !result || (result.total === 0 && !hasFilters) ? (
        <EmptyState
          title="No branches yet"
          description="Create your first branch to manage locations for this restaurant."
          action={
            canManage ? (
              <Button
                render={<Link href="/settings/branches/new" />}
                nativeButton={false}
              >
                Create branch
              </Button>
            ) : null
          }
        />
      ) : result.items.length === 0 ? (
        <EmptyState
          title="No matching branches"
          description="Try a different search or status filter."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                applyQuery({ q: undefined, status: "all", page: 1 });
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <ul
            className={`divide-border border-border bg-card divide-y rounded-xl border ${loading ? "opacity-60" : ""}`}
          >
            {result.items.map((branch) => (
              <li
                key={branch.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/settings/branches/${branch.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {branch.name}
                    </Link>
                    <StatusBadge
                      label={branch.is_active ? "Active" : "Inactive"}
                      tone={branch.is_active ? "success" : "warning"}
                    />
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {branch.slug}
                    {branch.city ? ` · ${branch.city}` : ""}
                    {branch.country ? ` · ${branch.country}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    render={<Link href={`/settings/branches/${branch.id}`} />}
                    nativeButton={false}
                    aria-label={`Edit ${branch.name}`}
                    title="Edit"
                  >
                    <Pencil />
                  </Button>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => onToggle(branch)}
                    >
                      {branch.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            pageSizeOptions={BRANCH_PAGE_SIZE_OPTIONS}
            onPageChange={(page) => applyQuery({ page })}
            onPageSizeChange={(pageSize) => applyQuery({ page: 1, pageSize })}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmBranch)}
        onOpenChange={(open) => {
          if (!open) setConfirmBranch(null);
        }}
        title="Deactivate branch?"
        description="This branch will no longer be selectable for day-to-day operations. Existing historical data is kept. You can activate it again later."
        confirmLabel="Deactivate"
        destructive
        loading={pending}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
