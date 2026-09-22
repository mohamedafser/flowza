import { hasPermission } from "@/lib/auth/permissions";
import { roleAtLeast, type MemberRole } from "@/lib/auth/roles";
import {
  TABLE_STATUSES,
  TABLE_STATUS_LABELS,
  type TableSortField,
  type TableStatus,
} from "@/lib/validations/table";
import type { StatusTone } from "@/types";

export type TableSectionRecord = {
  id: string;
  branch_id: string;
  name: string;
  sort_order: number;
};

export type RestaurantTableRecord = {
  id: string;
  branch_id: string;
  section_id: string | null;
  table_number: string;
  name: string | null;
  capacity: number;
  status: TableStatus;
  sort_order: number;
  cleaning_started_at?: string | null;
};

export type TableWithSection = RestaurantTableRecord & {
  section: TableSectionRecord | null;
};

export type TableStatistics = {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  reserved: number;
  blocked: number;
};

export type TableFilters = {
  search?: string;
  sectionId?: string | "all" | "none";
  status?: TableStatus | "all";
  sort?: TableSortField;
};

export function isTableStatus(value: unknown): value is TableStatus {
  return (
    typeof value === "string" &&
    (TABLE_STATUSES as readonly string[]).includes(value)
  );
}

export function canViewTables(role: MemberRole): boolean {
  return hasPermission(role, "tables.view");
}

export function canManageTables(role: MemberRole): boolean {
  return hasPermission(role, "tables.manage");
}

/** Operational roles may change availability without configuration access. */
export function canChangeTableStatus(role: MemberRole): boolean {
  return hasPermission(role, "tables.view");
}

export function canDeleteTables(role: MemberRole): boolean {
  return hasPermission(role, "tables.manage") && roleAtLeast(role, "MANAGER");
}

export function canManageTableSections(role: MemberRole): boolean {
  return hasPermission(role, "tables.manage") && roleAtLeast(role, "MANAGER");
}

export function tableStatusLabel(status: TableStatus): string {
  return TABLE_STATUS_LABELS[status];
}

export function tableStatusTone(status: TableStatus): StatusTone {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "OCCUPIED":
      return "danger";
    case "CLEANING":
      return "warning";
    case "RESERVED":
      return "info";
    case "BLOCKED":
      return "default";
  }
}

export function tableDisplayName(table: {
  table_number: string;
  name: string | null;
}): string {
  const name = table.name?.trim();
  if (name) {
    return name;
  }
  return `Table ${table.table_number}`;
}

export function compareTableNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function isValidTableStatusTransition(
  from: TableStatus,
  to: TableStatus,
): boolean {
  return isTableStatus(from) && isTableStatus(to);
}

/** Minutes a table stays CLEANING before auto-returning to AVAILABLE. */
export const CLEANING_AUTO_AVAILABLE_MINUTES = 10;

export function cleaningAutoAvailableAt(
  cleaningStartedAt: string | null | undefined,
  minutes = CLEANING_AUTO_AVAILABLE_MINUTES,
): Date | null {
  if (!cleaningStartedAt) return null;
  const started = new Date(cleaningStartedAt);
  if (Number.isNaN(started.getTime())) return null;
  return new Date(started.getTime() + minutes * 60_000);
}

/** Earliest ms until a CLEANING table should auto-become AVAILABLE (null if none). */
export function msUntilNextCleaningAutoAvailable(
  tables: readonly Pick<
    RestaurantTableRecord,
    "status" | "cleaning_started_at"
  >[],
  now = Date.now(),
  minutes = CLEANING_AUTO_AVAILABLE_MINUTES,
): number | null {
  let soonest: number | null = null;
  for (const table of tables) {
    if (table.status !== "CLEANING") continue;
    const at = cleaningAutoAvailableAt(table.cleaning_started_at, minutes);
    if (!at) continue;
    const remaining = at.getTime() - now;
    if (soonest === null || remaining < soonest) {
      soonest = remaining;
    }
  }
  return soonest;
}

export function deriveTableStatistics(
  tables: readonly Pick<RestaurantTableRecord, "status">[],
): TableStatistics {
  const stats: TableStatistics = {
    total: tables.length,
    available: 0,
    occupied: 0,
    cleaning: 0,
    reserved: 0,
    blocked: 0,
  };

  for (const table of tables) {
    switch (table.status) {
      case "AVAILABLE":
        stats.available += 1;
        break;
      case "OCCUPIED":
        stats.occupied += 1;
        break;
      case "CLEANING":
        stats.cleaning += 1;
        break;
      case "RESERVED":
        stats.reserved += 1;
        break;
      case "BLOCKED":
        stats.blocked += 1;
        break;
    }
  }

  return stats;
}

function matchesSearch(
  table: Pick<RestaurantTableRecord, "table_number" | "name">,
  search: string | undefined,
): boolean {
  const term = search?.trim().toLowerCase();
  if (!term) {
    return true;
  }

  const number = table.table_number.toLowerCase();
  const name = (table.name ?? "").toLowerCase();
  const display = tableDisplayName(table).toLowerCase();
  return number.includes(term) || name.includes(term) || display.includes(term);
}

function matchesSection(
  table: Pick<RestaurantTableRecord, "section_id">,
  sectionId: TableFilters["sectionId"],
): boolean {
  if (!sectionId || sectionId === "all") {
    return true;
  }
  if (sectionId === "none") {
    return table.section_id === null;
  }
  return table.section_id === sectionId;
}

function matchesStatus(
  table: Pick<RestaurantTableRecord, "status">,
  status: TableFilters["status"],
): boolean {
  if (!status || status === "all") {
    return true;
  }
  return table.status === status;
}

export function filterTables<T extends TableWithSection>(
  tables: readonly T[],
  filters: TableFilters,
): T[] {
  return tables.filter(
    (table) =>
      matchesSearch(table, filters.search) &&
      matchesSection(table, filters.sectionId) &&
      matchesStatus(table, filters.status),
  );
}

function sectionSortKey(table: TableWithSection): number {
  return table.section?.sort_order ?? Number.MAX_SAFE_INTEGER;
}

function sectionNameKey(table: TableWithSection): string {
  return table.section?.name ?? "";
}

export function sortTables<T extends TableWithSection>(
  tables: readonly T[],
  sort: TableSortField = "default",
): T[] {
  const copy = [...tables];

  copy.sort((a, b) => {
    switch (sort) {
      case "table_number": {
        const byNumber = compareTableNumbers(a.table_number, b.table_number);
        return byNumber !== 0 ? byNumber : a.id.localeCompare(b.id);
      }
      case "capacity": {
        const byCapacity = a.capacity - b.capacity;
        if (byCapacity !== 0) return byCapacity;
        return compareTableNumbers(a.table_number, b.table_number);
      }
      case "section": {
        const bySectionOrder = sectionSortKey(a) - sectionSortKey(b);
        if (bySectionOrder !== 0) return bySectionOrder;
        const bySectionName = sectionNameKey(a).localeCompare(
          sectionNameKey(b),
        );
        if (bySectionName !== 0) return bySectionName;
        return compareTableNumbers(a.table_number, b.table_number);
      }
      case "status": {
        const byStatus = a.status.localeCompare(b.status);
        if (byStatus !== 0) return byStatus;
        return compareTableNumbers(a.table_number, b.table_number);
      }
      default: {
        const bySection = sectionSortKey(a) - sectionSortKey(b);
        if (bySection !== 0) return bySection;
        const bySort = a.sort_order - b.sort_order;
        if (bySort !== 0) return bySort;
        const byNumber = compareTableNumbers(a.table_number, b.table_number);
        return byNumber !== 0 ? byNumber : a.id.localeCompare(b.id);
      }
    }
  });

  return copy;
}

export function queryTables<T extends TableWithSection>(
  tables: readonly T[],
  filters: TableFilters,
): T[] {
  return sortTables(filterTables(tables, filters), filters.sort ?? "default");
}

export type SectionGroup<T extends TableWithSection> = {
  section: TableSectionRecord | null;
  tables: T[];
};

export function groupTablesBySection<T extends TableWithSection>(
  tables: readonly T[],
  sections: readonly TableSectionRecord[],
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = sections
    .slice()
    .sort((a, b) => {
      const byOrder = a.sort_order - b.sort_order;
      if (byOrder !== 0) return byOrder;
      return a.name.localeCompare(b.name);
    })
    .map((section) => ({
      section,
      tables: tables.filter((table) => table.section_id === section.id),
    }));

  const unsectioned = tables.filter((table) => table.section_id === null);
  if (unsectioned.length > 0) {
    groups.push({ section: null, tables: unsectioned });
  }

  return groups.filter((group) => group.tables.length > 0);
}

export function sectionHasTables(
  sectionId: string,
  tables: readonly Pick<RestaurantTableRecord, "section_id">[],
): boolean {
  return tables.some((table) => table.section_id === sectionId);
}

export function canDeleteSection(
  sectionId: string,
  tables: readonly Pick<RestaurantTableRecord, "section_id">[],
  reassignToSectionId?: string | null,
): boolean {
  if (!sectionHasTables(sectionId, tables)) {
    return true;
  }
  if (reassignToSectionId === undefined) {
    return false;
  }
  if (reassignToSectionId === sectionId) {
    return false;
  }
  return true;
}

export type TableScopeCheck = {
  membershipRestaurantId: string | null;
  branchRestaurantId: string;
  resourceBranchId: string;
  expectedBranchId: string;
  sectionBranchId?: string | null;
};

export type TableScopeFailure = "restaurant" | "branch" | "section";

export function authorizeTableScope(
  input: TableScopeCheck,
): { ok: true } | { ok: false; reason: TableScopeFailure } {
  if (
    !input.membershipRestaurantId ||
    input.membershipRestaurantId !== input.branchRestaurantId
  ) {
    return { ok: false, reason: "restaurant" };
  }

  if (input.resourceBranchId !== input.expectedBranchId) {
    return { ok: false, reason: "branch" };
  }

  if (
    input.sectionBranchId !== undefined &&
    input.sectionBranchId !== null &&
    input.sectionBranchId !== input.expectedBranchId
  ) {
    return { ok: false, reason: "section" };
  }

  return { ok: true };
}

export function isDuplicateTableNumber(
  tables: readonly Pick<RestaurantTableRecord, "id" | "table_number">[],
  tableNumber: string,
  excludeId?: string,
): boolean {
  const normalized = tableNumber.trim().toLowerCase();
  return tables.some(
    (table) =>
      table.id !== excludeId &&
      table.table_number.trim().toLowerCase() === normalized,
  );
}

export function reorderSectionIds(
  sectionIds: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sectionIds.length ||
    toIndex >= sectionIds.length
  ) {
    return [...sectionIds];
  }

  const next = [...sectionIds];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return next;
  }
  next.splice(toIndex, 0, moved);
  return next;
}
