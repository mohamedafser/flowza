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
import { ADMIN_USERS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { AdminUserListItem } from "@/services/admin/admin-users.service";
import type { PageResult } from "@/services/admin/admin-client";
import type { Enums } from "@/types/database";
import { toast } from "sonner";

type Filters = {
  q: string;
  accountStatus: string;
  verification: string;
  role: string;
};

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function AdminUsersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get("q") ?? "",
    accountStatus: searchParams.get("accountStatus") ?? "ALL",
    verification: searchParams.get("verification") ?? "ALL",
    role: searchParams.get("role") ?? "ALL",
  });
  const debouncedQ = useDebounced(filters.q);
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [result, setResult] = useState<PageResult<AdminUserListItem> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{
    id: string;
    name: string;
    accountStatus: Enums<"account_status">;
  } | null>(null);
  const [mutating, setMutating] = useState(false);

  const syncUrl = useCallback(
    (next: Partial<Filters> & { page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...next };
      if (merged.q) params.set("q", merged.q);
      else params.delete("q");
      if (merged.accountStatus && merged.accountStatus !== "ALL")
        params.set("accountStatus", merged.accountStatus);
      else params.delete("accountStatus");
      if (merged.verification && merged.verification !== "ALL")
        params.set("verification", merged.verification);
      else params.delete("verification");
      if (merged.role && merged.role !== "ALL")
        params.set("role", merged.role);
      else params.delete("role");
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
    if (filters.accountStatus !== "ALL")
      params.set("accountStatus", filters.accountStatus);
    if (filters.verification !== "ALL")
      params.set("verification", filters.verification);
    if (filters.role !== "ALL") params.set("role", filters.role);

    void adminFetch<PageResult<AdminUserListItem>>(
      `/api/admin/users?${params.toString()}`,
    ).then((response) => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load users.");
        setResult(null);
        return;
      }
      setResult(response.data);
    });
    return () => cancelStart();
  }, [
    debouncedQ,
    filters.accountStatus,
    filters.verification,
    filters.role,
    page,
  ]);

  async function applyStatus() {
    if (!confirm) return;
    setMutating(true);
    const response = await adminFetch(`/api/admin/users/${confirm.id}`, {
      method: "PATCH",
      body: JSON.stringify({ accountStatus: confirm.accountStatus }),
    });
    setMutating(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to update user.");
      return;
    }
    toast.success(
      confirm.accountStatus === "DISABLED"
        ? "User account disabled."
        : "User account re-enabled.",
    );
    setConfirm(null);
    setResult((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              item.id === confirm.id
                ? { ...item, accountStatus: confirm.accountStatus }
                : item,
            ),
          }
        : prev,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Search platform users, review memberships, and manage account access."
        breadcrumbs={ADMIN_USERS_BREADCRUMBS}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="user-search">Search</Label>
          <Input
            id="user-search"
            value={filters.q}
            placeholder="Name or email"
            onChange={(event) => {
              const q = event.target.value;
              setFilters((prev) => ({ ...prev, q }));
              syncUrl({ q, page: 1 });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-account-status">Account</Label>
          <Select
            id="user-account-status"
            aria-label="Filter by account status"
            value={filters.accountStatus}
            onChange={(event) => {
              const accountStatus = event.target.value;
              setFilters((prev) => ({ ...prev, accountStatus }));
              syncUrl({ accountStatus, page: 1 });
            }}
          >
            <option value="ALL">All accounts</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="user-verification">Email</Label>
          <Select
            id="user-verification"
            aria-label="Filter by email verification"
            value={filters.verification}
            onChange={(event) => {
              const verification = event.target.value;
              setFilters((prev) => ({ ...prev, verification }));
              syncUrl({ verification, page: 1 });
            }}
          >
            <option value="ALL">All</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="user-role">Restaurant role</Label>
          <Select
            id="user-role"
            aria-label="Filter by restaurant role"
            value={filters.role}
            onChange={(event) => {
              const role = event.target.value;
              setFilters((prev) => ({ ...prev, role }));
              syncUrl({ role, page: 1 });
            }}
          >
            <option value="ALL">All roles</option>
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
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
        <ErrorState title="Unable to load users" message={error} />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Try adjusting search or filters."
        />
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Verified</th>
                  <th className="px-3 py-2 font-medium">Restaurants</th>
                  <th className="px-3 py-2 font-medium">Roles</th>
                  <th className="px-3 py-2 font-medium">Last sign-in</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.fullName ?? "—"}
                      </Link>
                      {item.platformRole ? (
                        <div className="text-muted-foreground text-xs">
                          Platform: {item.platformRole}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{item.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      {item.emailVerified ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {item.restaurantCount}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.roles.length > 0 ? item.roles.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.lastSignInAt
                        ? new Date(item.lastSignInAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.accountStatus} />
                    </td>
                    <td className="px-3 py-2">
                      {item.accountStatus === "ACTIVE" ? (
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() =>
                            setConfirm({
                              id: item.id,
                              name: item.fullName ?? item.email ?? "User",
                              accountStatus: "DISABLED",
                            })
                          }
                        >
                          Disable
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          onClick={() =>
                            setConfirm({
                              id: item.id,
                              name: item.fullName ?? item.email ?? "User",
                              accountStatus: "ACTIVE",
                            })
                          }
                        >
                          Re-enable
                        </Button>
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

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.accountStatus === "DISABLED"
            ? "Disable user account?"
            : "Re-enable user account?"
        }
        description={
          confirm?.accountStatus === "DISABLED"
            ? `${confirm.name} will lose access until re-enabled.`
            : `This will restore access for ${confirm?.name ?? "this user"}.`
        }
        confirmLabel={
          confirm?.accountStatus === "DISABLED" ? "Disable account" : "Re-enable"
        }
        destructive={confirm?.accountStatus === "DISABLED"}
        loading={mutating}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}
