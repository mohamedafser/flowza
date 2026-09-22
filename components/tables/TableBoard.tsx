"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ban,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import {
  createTableAction,
  deleteTableAction,
  getTablesBundleAction,
  updateTableAction,
  updateTableStatusAction,
} from "@/app/actions/tables";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RealtimeStatusIndicator } from "@/components/common/RealtimeStatusIndicator";
import { SearchInput } from "@/components/common/SearchInput";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableActionsMenu } from "@/components/tables/TableActionsMenu";
import { TableFormDialog } from "@/components/tables/TableFormDialog";
import { SectionManager } from "@/components/tables/SectionManager";
import { SETTINGS_TABLES_PATH } from "@/lib/auth/paths";
import { dashboardBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { cn } from "@/lib/utils";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { REALTIME_REFRESH_DEBOUNCE_MS } from "@/lib/realtime/types";
import { useTableRealtime } from "@/hooks/realtime/use-table-realtime";
import {
  deriveTableStatistics,
  groupTablesBySection,
  msUntilNextCleaningAutoAvailable,
  queryTables,
  tableDisplayName,
  tableStatusLabel,
  tableStatusTone,
  type TableSectionRecord,
  type TableStatistics,
  type TableWithSection,
} from "@/lib/utils/tables";
import {
  TABLE_SORT_FIELDS,
  TABLE_STATUSES,
  TABLE_STATUS_LABELS,
  type TableFormValues,
  type TableSortField,
  type TableStatus,
} from "@/lib/validations/table";
import type { Branch } from "@/lib/context/restaurant";

type TableBoardProps = {
  branch: Branch;
  tables: TableWithSection[];
  sections: TableSectionRecord[];
  canManage: boolean;
  canDelete: boolean;
  canManageSections: boolean;
  canChangeStatus: boolean;
};

type ViewMode = "list" | "visual";

const SORT_LABELS: Record<TableSortField, string> = {
  default: "Default",
  table_number: "Table number",
  capacity: "Capacity",
  section: "Section",
  status: "Status",
};

const STATUS_STAT_CARDS: Array<{
  title: string;
  status: TableStatus | "all";
  icon?: React.ReactNode;
}> = [
  { title: "Total", status: "all", icon: <UtensilsCrossed /> },
  { title: "Available", status: "AVAILABLE", icon: <Sparkles /> },
  { title: "Occupied", status: "OCCUPIED" },
  { title: "Cleaning", status: "CLEANING" },
  { title: "Reserved", status: "RESERVED" },
  { title: "Blocked", status: "BLOCKED", icon: <Ban /> },
];

function valueForStatusFilter(
  stats: TableStatistics,
  status: TableStatus | "all",
): number {
  switch (status) {
    case "AVAILABLE":
      return stats.available;
    case "OCCUPIED":
      return stats.occupied;
    case "CLEANING":
      return stats.cleaning;
    case "RESERVED":
      return stats.reserved;
    case "BLOCKED":
      return stats.blocked;
    default:
      return stats.total;
  }
}

export function TableBoard({
  branch,
  tables: initialTables,
  sections: initialSections,
  canManage,
  canDelete,
  canManageSections,
  canChangeStatus,
}: TableBoardProps) {
  const [tables, setTables] = useState(initialTables);
  const [sections, setSections] = useState(initialSections);
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState<string>("all");
  const [status, setStatus] = useState<TableStatus | "all">("all");
  const [sort, setSort] = useState<TableSortField>("default");
  const [view, setView] = useState<ViewMode>("visual");
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TableWithSection | null>(null);
  const [deleting, setDeleting] = useState<TableWithSection | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<
    Record<string, TableStatus>
  >({});
  const refreshController = useRef<ReturnType<
    typeof createCoalescedRefresh
  > | null>(null);

  const loadBundle = useCallback(async () => {
    const result = await getTablesBundleAction({ branchId: branch.id });
    if (result.ok && result.data) {
      setTables(result.data.tables);
      setSections(result.data.sections);
      setOptimisticStatus({});
    }
  }, [branch.id]);

  useEffect(() => {
    const controller = createCoalescedRefresh(
      loadBundle,
      REALTIME_REFRESH_DEBOUNCE_MS,
    );
    refreshController.current = controller;
    return () => {
      controller.cancel();
      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    };
  }, [loadBundle]);

  const { status: realtimeStatus } = useTableRealtime({
    restaurantId: branch.restaurant_id,
    branchId: branch.id,
    onChange: () => {
      refreshController.current?.request();
    },
  });

  useEffect(() => {
    const remaining = msUntilNextCleaningAutoAvailable(tables);
    if (remaining === null) return;
    const delay = Math.max(remaining + 250, 0);
    const timer = window.setTimeout(() => {
      refreshController.current?.request();
    }, Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [tables]);

  const displayTables = useMemo(
    () =>
      tables.map((table) => ({
        ...table,
        status: optimisticStatus[table.id] ?? table.status,
      })),
    [optimisticStatus, tables],
  );

  const stats = useMemo(
    () => deriveTableStatistics(displayTables),
    [displayTables],
  );

  const visibleTables = useMemo(
    () =>
      queryTables(displayTables, {
        search,
        sectionId: sectionId as "all" | "none" | string,
        status,
        sort,
      }),
    [displayTables, search, sectionId, sort, status],
  );

  const groups = useMemo(
    () => groupTablesBySection(visibleTables, sections),
    [sections, visibleTables],
  );

  const hasFilters =
    search.trim() !== "" || sectionId !== "all" || status !== "all";

  const setStatusFilter = (next: TableStatus | "all") => {
    setStatus((current) => (current === next && next !== "all" ? "all" : next));
  };

  const refresh = () => {
    refreshController.current?.request();
  };

  const changeStatus = (table: TableWithSection, next: TableStatus) => {
    if (!canChangeStatus || pending || saving) return;
    const previous = optimisticStatus[table.id] ?? table.status;
    setOptimisticStatus((current) => ({ ...current, [table.id]: next }));
    startTransition(async () => {
      try {
        const result = await updateTableStatusAction({
          tableId: table.id,
          status: next,
        });
        if (!result.ok) {
          setOptimisticStatus((current) => ({
            ...current,
            [table.id]: previous,
          }));
          toast.error(result.message ?? "Unable to update table status.");
          return;
        }
        toast.success(
          `${tableDisplayName(table)} is now ${tableStatusLabel(next).toLowerCase()}.`,
        );
        refresh();
      } catch {
        setOptimisticStatus((current) => ({
          ...current,
          [table.id]: previous,
        }));
        toast.error("Network error. Check your connection and try again.");
      }
    });
  };

  const submitForm = async (values: TableFormValues) => {
    if (!canManage || saving) return;
    setSaving(true);
    const nextSectionId = values.sectionId ? values.sectionId : null;
    const name = values.name.trim() ? values.name.trim() : undefined;
    try {
      if (editing) {
        const result = await updateTableAction({
          tableId: editing.id,
          tableNumber: values.tableNumber,
          name,
          sectionId: nextSectionId,
          capacity: values.capacity,
          sortOrder: values.sortOrder,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Unable to update table.");
          return;
        }
        toast.success("Table updated.");
      } else {
        const result = await createTableAction({
          branchId: branch.id,
          tableNumber: values.tableNumber,
          name,
          sectionId: nextSectionId,
          capacity: values.capacity,
          status: values.status,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Unable to create table.");
          return;
        }
        toast.success("Table created.");
      }
      setFormOpen(false);
      setEditing(null);
      refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !canDelete || saving) return;
    const table = deleting;
    setSaving(true);
    try {
      const result = await deleteTableAction({ tableId: table.id });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to delete table.");
        return;
      }
      toast.success("Table deleted.");
      setDeleting(null);
      refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tables"
        description="Manage tables, seating capacity, sections, and availability."
        breadcrumbs={dashboardBreadcrumbs({ label: "Tables" })}
        actions={
          <>
            <RealtimeStatusIndicator status={realtimeStatus} />
            <Button
              variant="outline"
              onClick={() => refresh()}
              disabled={pending || saving}
            >
              <RefreshCw />
              Refresh
            </Button>
            {canManageSections ? (
              <Button variant="outline" onClick={() => setSectionsOpen(true)}>
                Manage sections
              </Button>
            ) : null}
            {canManage ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Add table
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-6">
        {STATUS_STAT_CARDS.map((card) => (
          <StatCard
            key={card.status}
            title={card.title}
            value={valueForStatusFilter(stats, card.status)}
            icon={card.icon}
            selected={status === card.status}
            aria-label={
              card.status === "all"
                ? "Show all tables"
                : `Filter tables by ${card.title.toLowerCase()}`
            }
            onClick={() => setStatusFilter(card.status)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tables…"
          className="w-full max-w-none flex-1 lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <Select
            aria-label="Filter by section"
            className="lg:w-40"
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
          >
            <option value="all">All sections</option>
            <option value="none">No section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            className="lg:w-40"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as TableStatus | "all")
            }
          >
            <option value="all">All statuses</option>
            {TABLE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TABLE_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort tables"
            className="lg:w-40"
            value={sort}
            onChange={(event) => setSort(event.target.value as TableSortField)}
          >
            {TABLE_SORT_FIELDS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </Select>
          <div className="border-border flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              className="flex-1"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "visual" ? "secondary" : "ghost"}
              className="flex-1"
              aria-pressed={view === "visual"}
              onClick={() => setView("visual")}
            >
              <LayoutGrid />
              <span className="hidden sm:inline">Floor</span>
            </Button>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mb-4 text-sm">
        Showing tables for{" "}
        <span className="text-foreground font-medium">{branch.name}</span>
        {saving || pending ? " · Saving…" : null}
      </p>

      {tables.length === 0 ? (
        <EmptyState
          title="No tables have been added yet."
          description="Add tables for this branch to track seating capacity and availability."
          action={
            canManage ? (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                Add table
              </Button>
            ) : null
          }
        />
      ) : visibleTables.length === 0 ? (
        <EmptyState
          title="No tables match your filters."
          description="Try a different search, section, or status."
        />
      ) : view === "list" ? (
        <TableListView
          tables={visibleTables}
          branchName={branch.name}
          canManage={canManage}
          canDelete={canDelete}
          canChangeStatus={canChangeStatus}
          disabled={pending || saving}
          onStatusChange={changeStatus}
          onEdit={(table) => {
            setEditing(table);
            setFormOpen(true);
          }}
          onDelete={setDeleting}
        />
      ) : (
        <TableVisualView
          groups={groups}
          branchName={branch.name}
          canManage={canManage}
          canDelete={canDelete}
          canChangeStatus={canChangeStatus}
          disabled={pending || saving}
          onStatusChange={changeStatus}
          onEdit={(table) => {
            setEditing(table);
            setFormOpen(true);
          }}
          onDelete={setDeleting}
        />
      )}

      {hasFilters && tables.length > 0 ? (
        <p className="text-muted-foreground mt-4 text-xs">
          {visibleTables.length} of {tables.length} tables shown.
        </p>
      ) : null}

      <TableFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        mode={editing ? "edit" : "create"}
        table={editing}
        sections={sections}
        pending={saving}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete table?"
        description="This removes the table from this branch. Prefer marking it blocked if you may need it again."
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={confirmDelete}
      />

      <Dialog open={sectionsOpen} onOpenChange={setSectionsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage sections</DialogTitle>
            <DialogDescription>
              Create, rename, reorder, or delete sections for {branch.name}.
            </DialogDescription>
          </DialogHeader>
          <SectionManager
            branchId={branch.id}
            sections={sections}
            tables={tables}
            canManage={canManageSections}
          />
          <Button
            variant="outline"
            render={<Link href={SETTINGS_TABLES_PATH} />}
            nativeButton={false}
            className="w-full"
          >
            Open full section settings
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TableViewHandlers = {
  tables?: TableWithSection[];
  groups?: Array<{
    section: TableSectionRecord | null;
    tables: TableWithSection[];
  }>;
  branchName: string;
  canManage: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  disabled: boolean;
  onStatusChange: (table: TableWithSection, status: TableStatus) => void;
  onEdit: (table: TableWithSection) => void;
  onDelete: (table: TableWithSection) => void;
};

function TableCard({
  table,
  branchName,
  canManage,
  canDelete,
  canChangeStatus,
  disabled,
  compact = false,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  table: TableWithSection;
  compact?: boolean;
} & Omit<TableViewHandlers, "tables" | "groups">) {
  return (
    <article
      className={cn(
        "border-border bg-card rounded-xl border p-3",
        compact && "min-h-[8.5rem]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{tableDisplayName(table)}</h3>
          <p className="text-muted-foreground text-xs">
            #{table.table_number}
            {table.section ? ` · ${table.section.name}` : " · No section"}
            {` · ${branchName}`}
          </p>
        </div>
        <TableActionsMenu
          table={table}
          canManage={canManage}
          canDelete={canDelete}
          canChangeStatus={canChangeStatus}
          disabled={disabled}
          onStatusChange={(status) => onStatusChange(table, status)}
          onEdit={() => onEdit(table)}
          onDelete={() => onDelete(table)}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={tableStatusLabel(table.status)}
          tone={tableStatusTone(table.status)}
        />
        <span className="text-muted-foreground text-xs">
          {table.capacity} {table.capacity === 1 ? "seat" : "seats"}
        </span>
      </div>
    </article>
  );
}

function TableListView({ tables = [], ...handlers }: TableViewHandlers) {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="bg-muted/40 text-muted-foreground hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5rem_8rem_auto] gap-3 border-b px-4 py-2 text-xs font-medium md:grid">
        <span>Table</span>
        <span>Section</span>
        <span>Seats</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y md:divide-y-0">
        {tables.map((table) => (
          <li key={table.id}>
            <div className="p-3 md:hidden">
              <TableCard table={table} {...handlers} />
            </div>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5rem_8rem_auto] items-center gap-3 px-4 py-3 md:grid">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {tableDisplayName(table)}
                </p>
                <p className="text-muted-foreground text-xs">
                  #{table.table_number} · {handlers.branchName}
                </p>
              </div>
              <p className="text-muted-foreground truncate text-sm">
                {table.section?.name ?? "No section"}
              </p>
              <p className="text-sm">{table.capacity}</p>
              <StatusBadge
                label={tableStatusLabel(table.status)}
                tone={tableStatusTone(table.status)}
              />
              <div className="flex justify-end">
                <TableActionsMenu
                  table={table}
                  canManage={handlers.canManage}
                  canDelete={handlers.canDelete}
                  canChangeStatus={handlers.canChangeStatus}
                  disabled={handlers.disabled}
                  onStatusChange={(status) =>
                    handlers.onStatusChange(table, status)
                  }
                  onEdit={() => handlers.onEdit(table)}
                  onDelete={() => handlers.onDelete(table)}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableVisualView({ groups = [], ...handlers }: TableViewHandlers) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.section?.id ?? "none"}>
          <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
            {group.section?.name ?? "No section"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.tables.map((table) => (
              <TableCard key={table.id} table={table} compact {...handlers} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
