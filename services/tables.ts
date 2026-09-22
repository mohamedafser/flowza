import { AuthorizationError, requirePermission } from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import { createClient } from "@/lib/supabase/server";
import {
  canDeleteTables,
  canManageTableSections,
  canManageTables,
  isValidTableStatusTransition,
  type RestaurantTableRecord,
  type TableSectionRecord,
  type TableWithSection,
} from "@/lib/utils/tables";
import type {
  CreateTableInput,
  CreateTableSectionInput,
  DeleteTableInput,
  DeleteTableSectionInput,
  ReorderTableSectionsInput,
  TableStatus,
  UpdateTableInput,
  UpdateTableSectionInput,
  UpdateTableStatusInput,
} from "@/lib/validations/table";
import { writeAuditLog } from "@/services/audit";
import { releaseExpiredCleaningTables } from "@/services/table-cleaning";
import type { Branch } from "@/lib/context/restaurant";
import type { Tables } from "@/types/database";

export type TableSection = Tables<"table_sections">;
export type RestaurantTable = Tables<"restaurant_tables">;
export type { RestaurantTableRecord, TableSectionRecord, TableWithSection };

export { releaseExpiredCleaningTables };

export type TablesBundle = {
  branch: Branch;
  tables: TableWithSection[];
  sections: TableSectionRecord[];
};

export type TableMutationCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "SUBSCRIPTION_LIMIT_REACHED"
  | "UNKNOWN";

export type TableMutationResult =
  | { ok: true; table: RestaurantTableRecord }
  | { ok: false; message: string; code: TableMutationCode };

export type SectionMutationResult =
  | { ok: true; section: TableSectionRecord }
  | { ok: false; message: string; code: TableMutationCode };

export type SectionListMutationResult =
  | { ok: true; sections: TableSectionRecord[] }
  | { ok: false; message: string; code: TableMutationCode };

function asTable(row: RestaurantTable): RestaurantTableRecord {
  return {
    id: row.id,
    branch_id: row.branch_id,
    section_id: row.section_id,
    table_number: row.table_number,
    name: row.name,
    capacity: row.capacity,
    status: row.status,
    sort_order: row.sort_order,
    cleaning_started_at: row.cleaning_started_at,
  };
}

function asSection(row: TableSection): TableSectionRecord {
  return {
    id: row.id,
    branch_id: row.branch_id,
    name: row.name,
    sort_order: row.sort_order,
  };
}

function mapSectionJoin(
  value: TableSection | TableSection[] | null,
): TableSectionRecord | null {
  if (!value) {
    return null;
  }
  const row = Array.isArray(value) ? (value[0] ?? null) : value;
  return row ? asSection(row) : null;
}

type TableRowWithSection = RestaurantTable & {
  section: TableSection | TableSection[] | null;
};

function asTableWithSection(row: TableRowWithSection): TableWithSection {
  return {
    ...asTable(row),
    section: mapSectionJoin(row.section),
  };
}

async function loadAuthorizedBranch(
  branchId: string,
  permission: "tables.view" | "tables.manage",
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .maybeSingle();

  if (error || !data) {
    throw new AuthorizationError("FORBIDDEN", "Branch not found.");
  }

  const context = await requirePermission(data.restaurant_id, permission);
  return { branch: data, context };
}

async function loadAuthorizedTable(
  tableId: string,
  permission: "tables.view" | "tables.manage",
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("id", tableId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const authorized = await loadAuthorizedBranch(data.branch_id, permission);
  return { table: asTable(data), ...authorized };
}

async function loadAuthorizedSection(
  sectionId: string,
  permission: "tables.view" | "tables.manage",
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_sections")
    .select("*")
    .eq("id", sectionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const authorized = await loadAuthorizedBranch(data.branch_id, permission);
  return { section: asSection(data), ...authorized };
}

async function requireSectionForBranch(
  branchId: string,
  sectionId: string | null,
): Promise<TableSectionRecord | null> {
  if (!sectionId) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_sections")
    .select("*")
    .eq("id", sectionId)
    .maybeSingle();

  if (error || !data) {
    throw new AuthorizationError("FORBIDDEN", "Section not found.");
  }

  if (data.branch_id !== branchId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Section does not belong to this branch.",
    );
  }

  return asSection(data);
}

async function nextTableSortOrder(branchId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurant_tables")
    .select("sort_order")
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.sort_order ?? -1) + 1;
}

async function nextSectionSortOrder(branchId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("table_sections")
    .select("sort_order")
    .eq("branch_id", branchId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.sort_order ?? -1) + 1;
}

export async function getTableSections(
  branchId: string,
): Promise<TableSectionRecord[]> {
  const { branch } = await loadAuthorizedBranch(branchId, "tables.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_sections")
    .select("*")
    .eq("branch_id", branch.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(asSection);
}

export async function getTables(branchId: string): Promise<TableWithSection[]> {
  const bundle = await getTablesBundle(branchId);
  return bundle.tables;
}

export async function getTable(
  tableId: string,
): Promise<TableWithSection | null> {
  const loaded = await loadAuthorizedTable(tableId, "tables.view");
  if (!loaded) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*, section:table_sections(*)")
    .eq("id", tableId)
    .eq("branch_id", loaded.branch.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return asTableWithSection(data as TableRowWithSection);
}

export async function getTablesBundle(branchId: string): Promise<TablesBundle> {
  const { branch } = await loadAuthorizedBranch(branchId, "tables.view");
  const supabase = await createClient();

  await releaseExpiredCleaningTables(supabase, branch.id);

  const [tablesResult, sectionsResult] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("*, section:table_sections(*)")
      .eq("branch_id", branch.id)
      .order("sort_order", { ascending: true })
      .order("table_number", { ascending: true }),
    supabase
      .from("table_sections")
      .select("*")
      .eq("branch_id", branch.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const tables = (tablesResult.data ?? []).map((row) =>
    asTableWithSection(row as TableRowWithSection),
  );
  const sections = (sectionsResult.data ?? []).map(asSection);

  return { branch, tables, sections };
}

export async function createTable(
  input: CreateTableInput,
): Promise<TableMutationResult> {
  const { branch, context } = await loadAuthorizedBranch(
    input.branchId,
    "tables.manage",
  );

  if (!canManageTables(context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to create tables.",
    );
  }

  try {
    const { assertUsageLimit } = await import(
      "@/services/billing/entitlement.service"
    );
    await assertUsageLimit(branch.restaurant_id, "tables");
  } catch (error) {
    const { isSubscriptionLimitError } = await import("@/lib/billing/errors");
    if (isSubscriptionLimitError(error)) {
      return {
        ok: false,
        code: "SUBSCRIPTION_LIMIT_REACHED",
        message: error.message,
      };
    }
    throw error;
  }

  try {
    await requireSectionForBranch(branch.id, input.sectionId ?? null);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, code: "FORBIDDEN", message: error.message };
    }
    throw error;
  }

  const sortOrder = input.sortOrder ?? (await nextTableSortOrder(branch.id));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({
      branch_id: branch.id,
      section_id: input.sectionId ?? null,
      table_number: input.tableNumber,
      name: input.name?.trim() ? input.name.trim() : null,
      capacity: input.capacity,
      status: input.status,
      sort_order: sortOrder,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /restaurant_tables_branch_number_unique|duplicate key/i.test(
        error.message,
      )
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create table. Please try again.",
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create table. Please try again.",
    };
  }

  const table = asTable(data);
  await writeAuditLog({
    restaurantId: branch.restaurant_id,
    userId: context.user.id,
    action: "table.created",
    entityType: "restaurant_table",
    entityId: table.id,
    metadata: {
      branchId: branch.id,
      tableNumber: table.table_number,
      capacity: table.capacity,
      status: table.status,
      sectionId: table.section_id,
    },
  });

  return { ok: true, table };
}

export async function updateTable(
  input: UpdateTableInput,
): Promise<TableMutationResult> {
  const loaded = await loadAuthorizedTable(input.tableId, "tables.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Table not found." };
  }

  if (!canManageTables(loaded.context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to update tables.",
    );
  }

  try {
    await requireSectionForBranch(loaded.branch.id, input.sectionId ?? null);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, code: "FORBIDDEN", message: error.message };
    }
    throw error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .update({
      table_number: input.tableNumber,
      name: input.name?.trim() ? input.name.trim() : null,
      section_id: input.sectionId ?? null,
      capacity: input.capacity,
      sort_order: input.sortOrder ?? loaded.table.sort_order,
    })
    .eq("id", loaded.table.id)
    .eq("branch_id", loaded.branch.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /restaurant_tables_branch_number_unique|duplicate key/i.test(
        error.message,
      )
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update table. Please try again.",
      ),
    };
  }

  if (!data) {
    return { ok: false, code: "NOT_FOUND", message: "Table not found." };
  }

  const table = asTable(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "table.updated",
    entityType: "restaurant_table",
    entityId: table.id,
    metadata: {
      branchId: loaded.branch.id,
      tableNumber: table.table_number,
      capacity: table.capacity,
      sectionId: table.section_id,
      sortOrder: table.sort_order,
    },
  });

  return { ok: true, table };
}

export async function updateTableStatus(
  input: UpdateTableStatusInput,
): Promise<TableMutationResult> {
  const loaded = await loadAuthorizedTable(input.tableId, "tables.view");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Table not found." };
  }

  if (!isValidTableStatusTransition(loaded.table.status, input.status)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Invalid table status.",
    };
  }

  if (loaded.table.status === input.status) {
    return { ok: true, table: loaded.table };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .update({ status: input.status })
    .eq("id", loaded.table.id)
    .eq("branch_id", loaded.branch.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update table status. Please try again.",
      ),
    };
  }

  const table = asTable(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "table.status_changed",
    entityType: "restaurant_table",
    entityId: table.id,
    metadata: {
      branchId: loaded.branch.id,
      tableNumber: table.table_number,
      from: loaded.table.status,
      to: table.status,
    },
  });

  return { ok: true, table };
}

export async function deleteTable(
  input: DeleteTableInput,
): Promise<TableMutationResult> {
  const loaded = await loadAuthorizedTable(input.tableId, "tables.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Table not found." };
  }

  if (!canDeleteTables(loaded.context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to delete tables.",
    );
  }

  const snapshot = loaded.table;
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_tables")
    .delete()
    .eq("id", loaded.table.id)
    .eq("branch_id", loaded.branch.id);

  if (error) {
    return {
      ok: false,
      code: /foreign key|referenced/i.test(error.message)
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to delete table. It may still be referenced by other records.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "table.deleted",
    entityType: "restaurant_table",
    entityId: snapshot.id,
    metadata: {
      branchId: loaded.branch.id,
      tableNumber: snapshot.table_number,
      status: snapshot.status,
    },
  });

  return { ok: true, table: snapshot };
}

export async function createTableSection(
  input: CreateTableSectionInput,
): Promise<SectionMutationResult> {
  const { branch, context } = await loadAuthorizedBranch(
    input.branchId,
    "tables.manage",
  );

  if (!canManageTableSections(context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to manage sections.",
    );
  }

  const sortOrder = await nextSectionSortOrder(branch.id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_sections")
    .insert({
      branch_id: branch.id,
      name: input.name,
      sort_order: sortOrder,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /table_sections_branch_name_unique|duplicate key/i.test(
        error.message,
      )
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create section. Please try again.",
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create section. Please try again.",
    };
  }

  const section = asSection(data);
  await writeAuditLog({
    restaurantId: branch.restaurant_id,
    userId: context.user.id,
    action: "table_section.created",
    entityType: "table_section",
    entityId: section.id,
    metadata: { branchId: branch.id, name: section.name },
  });

  return { ok: true, section };
}

export async function updateTableSection(
  input: UpdateTableSectionInput,
): Promise<SectionMutationResult> {
  const loaded = await loadAuthorizedSection(input.sectionId, "tables.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Section not found." };
  }

  if (!canManageTableSections(loaded.context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to manage sections.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_sections")
    .update({ name: input.name })
    .eq("id", loaded.section.id)
    .eq("branch_id", loaded.branch.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /table_sections_branch_name_unique|duplicate key/i.test(
        error.message,
      )
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update section. Please try again.",
      ),
    };
  }

  if (!data) {
    return { ok: false, code: "NOT_FOUND", message: "Section not found." };
  }

  const section = asSection(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "table_section.updated",
    entityType: "table_section",
    entityId: section.id,
    metadata: { branchId: loaded.branch.id, name: section.name },
  });

  return { ok: true, section };
}

export async function deleteTableSection(
  input: DeleteTableSectionInput,
): Promise<SectionMutationResult> {
  const loaded = await loadAuthorizedSection(input.sectionId, "tables.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Section not found." };
  }

  if (!canManageTableSections(loaded.context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to manage sections.",
    );
  }

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("restaurant_tables")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", loaded.branch.id)
    .eq("section_id", loaded.section.id);

  if (countError) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to delete section. Please try again.",
    };
  }

  const assignedCount = count ?? 0;
  if (assignedCount > 0 && input.reassignToSectionId === undefined) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "Move tables to another section before deleting this one.",
    };
  }

  if (input.reassignToSectionId) {
    try {
      await requireSectionForBranch(
        loaded.branch.id,
        input.reassignToSectionId,
      );
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return { ok: false, code: "FORBIDDEN", message: error.message };
      }
      throw error;
    }

    if (input.reassignToSectionId === loaded.section.id) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Choose a different section for the assigned tables.",
      };
    }
  }

  if (assignedCount > 0) {
    const { error: reassignError } = await supabase
      .from("restaurant_tables")
      .update({ section_id: input.reassignToSectionId ?? null })
      .eq("branch_id", loaded.branch.id)
      .eq("section_id", loaded.section.id);

    if (reassignError) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: safeDatabaseMessage(
          reassignError,
          "Unable to move tables before deleting this section.",
        ),
      };
    }
  }

  const { error } = await supabase
    .from("table_sections")
    .delete()
    .eq("id", loaded.section.id)
    .eq("branch_id", loaded.branch.id);

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to delete section. Please try again.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "table_section.deleted",
    entityType: "table_section",
    entityId: loaded.section.id,
    metadata: {
      branchId: loaded.branch.id,
      name: loaded.section.name,
      reassignedTo: input.reassignToSectionId ?? null,
      movedTables: assignedCount,
    },
  });

  return { ok: true, section: loaded.section };
}

export async function reorderTableSections(
  input: ReorderTableSectionsInput,
): Promise<SectionListMutationResult> {
  const { branch, context } = await loadAuthorizedBranch(
    input.branchId,
    "tables.manage",
  );

  if (!canManageTableSections(context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to manage sections.",
    );
  }

  const existing = await getTableSections(branch.id);
  const existingIds = new Set(existing.map((section) => section.id));

  if (input.sectionIds.length !== existing.length) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Section order must include every section in this branch.",
    };
  }

  for (const sectionId of input.sectionIds) {
    if (!existingIds.has(sectionId)) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "A section does not belong to this branch.",
      };
    }
  }

  const supabase = await createClient();
  const updates = input.sectionIds.map((sectionId, index) =>
    supabase
      .from("table_sections")
      .update({ sort_order: index })
      .eq("id", sectionId)
      .eq("branch_id", branch.id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        failed.error,
        "Unable to reorder sections. Please try again.",
      ),
    };
  }

  const sections = await getTableSections(branch.id);
  await writeAuditLog({
    restaurantId: branch.restaurant_id,
    userId: context.user.id,
    action: "table_section.reordered",
    entityType: "table_section",
    entityId: branch.id,
    metadata: {
      branchId: branch.id,
      sectionIds: input.sectionIds,
    },
  });

  return { ok: true, sections };
}

export type { TableStatus };
