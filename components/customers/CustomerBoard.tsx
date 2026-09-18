"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Plus, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { SearchInput } from "@/components/common/SearchInput";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { DASHBOARD_CUSTOMERS_PATH } from "@/lib/auth/paths";
import { CUSTOMERS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { formatDate } from "@/lib/utils/datetime";
import {
  filterCustomers,
  paginateCustomers,
  type CustomerListItem,
  type CustomerStats,
} from "@/lib/utils/customers";
import {
  DEFAULT_CUSTOMER_PAGE_SIZE,
  CUSTOMER_PAGE_SIZE_OPTIONS,
  type CustomerStatFilter,
} from "@/lib/validations/customer";

type CustomerBoardProps = {
  customers: CustomerListItem[];
  stats: CustomerStats;
  timezone: string;
  canManage: boolean;
};

const STAT_CARDS: Array<{
  title: string;
  filter: CustomerStatFilter;
  key: keyof CustomerStats;
  icon?: React.ReactNode;
}> = [
  { title: "Total customers", filter: "all", key: "total", icon: <Users /> },
  { title: "Added today", filter: "today", key: "addedToday" },
  { title: "Added this week", filter: "week", key: "addedThisWeek" },
  {
    title: "With phone",
    filter: "phone",
    key: "withPhone",
    icon: <Phone />,
  },
  {
    title: "With email",
    filter: "email",
    key: "withEmail",
    icon: <Mail />,
  },
];

function visitLabel(customer: CustomerListItem): string {
  return customer.visits.visitCount == null
    ? "—"
    : String(customer.visits.visitCount);
}

function lastVisitLabel(customer: CustomerListItem, timezone: string): string {
  if (!customer.visits.lastVisitAt) {
    return "—";
  }
  return formatDate(
    new Date(customer.visits.lastVisitAt),
    "DD/MM/YYYY",
    timezone,
  );
}

export function CustomerBoard({
  customers,
  stats,
  timezone,
  canManage,
}: CustomerBoardProps) {
  const [search, setSearch] = useState("");
  const [stat, setStat] = useState<CustomerStatFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_CUSTOMER_PAGE_SIZE);

  const visible = useMemo(
    () => filterCustomers(customers, { search, stat }, timezone),
    [customers, search, stat, timezone],
  );

  const paged = useMemo(
    () => paginateCustomers(visible, page, pageSize),
    [page, pageSize, visible],
  );

  const hasQuery = search.trim() !== "" || stat !== "all";

  const setSearchValue = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const setStatFilter = (next: CustomerStatFilter) => {
    setStat((current) => (current === next && next !== "all" ? "all" : next));
    setPage(1);
  };

  const addAction = canManage ? (
    <Button
      render={<Link href={`${DASHBOARD_CUSTOMERS_PATH}/new`} />}
      nativeButton={false}
    >
      <Plus />
      Add customer
    </Button>
  ) : null;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your restaurant's customer records."
        breadcrumbs={CUSTOMERS_BREADCRUMBS}
        actions={addAction}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.filter}
            title={card.title}
            value={stats[card.key]}
            icon={card.icon}
            selected={stat === card.filter}
            aria-label={`Filter customers: ${card.title.toLowerCase()}`}
            onClick={() => setStatFilter(card.filter)}
          />
        ))}
      </div>

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearchValue}
          placeholder="Search customers by name, phone or email"
          className="w-full max-w-none sm:max-w-md"
        />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet."
          description="Add a guest so future queue visits can be linked to the same person across branches."
          icon={<UserPlus className="size-8" />}
          action={addAction}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No customers match your search."
          description={
            hasQuery
              ? "Try a different name, phone, email, or clear the current filter."
              : undefined
          }
        />
      ) : (
        <>
          <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 text-right font-medium">Visits</th>
                  <th className="px-4 py-2.5 font-medium">Last visit</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-border hover:bg-muted/30 border-t"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`${DASHBOARD_CUSTOMERS_PATH}/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="hover:underline"
                        >
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="hover:underline"
                        >
                          {customer.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                      <span title="Visit history will appear after queue is enabled">
                        {visitLabel(customer)}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      <span title="Visit history will appear after queue is enabled">
                        {lastVisitLabel(customer, timezone)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(
                        new Date(customer.created_at),
                        "DD/MM/YYYY",
                        timezone,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {paged.items.map((customer) => (
              <li key={customer.id}>
                <article className="border-border bg-card rounded-xl border p-4">
                  <Link
                    href={`${DASHBOARD_CUSTOMERS_PATH}/${customer.id}`}
                    className="text-base font-medium hover:underline"
                  >
                    {customer.name}
                  </Link>
                  <div className="mt-3 space-y-2 text-sm">
                    {customer.phone ? (
                      <a
                        href={`tel:${customer.phone}`}
                        className="flex min-h-11 items-center gap-2 hover:underline"
                      >
                        <Phone className="text-muted-foreground size-4" />
                        {customer.phone}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No phone</p>
                    )}
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="flex min-h-11 items-center gap-2 break-all hover:underline"
                      >
                        <Mail className="text-muted-foreground size-4 shrink-0" />
                        {customer.email}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">No email</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Added{" "}
                      {formatDate(
                        new Date(customer.created_at),
                        "DD/MM/YYYY",
                        timezone,
                      )}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>

          <Pagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            pageSize={pageSize}
            pageSizeOptions={CUSTOMER_PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
            className="mt-4"
          />
        </>
      )}
    </div>
  );
}
