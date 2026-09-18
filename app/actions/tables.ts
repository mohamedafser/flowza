"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import { DASHBOARD_TABLES_PATH, SETTINGS_TABLES_PATH } from "@/lib/auth/paths";
import {
  createTableSchema,
  createTableSectionSchema,
  deleteTableSchema,
  deleteTableSectionSchema,
  reorderTableSectionsSchema,
  tablesBundleQuerySchema,
  updateTableSchema,
  updateTableSectionSchema,
  updateTableStatusSchema,
} from "@/lib/validations/table";
import {
  createTable,
  createTableSection,
  deleteTable,
  deleteTableSection,
  getTablesBundle,
  reorderTableSections,
  updateTable,
  updateTableSection,
  updateTableStatus,
  type RestaurantTableRecord,
  type TableSectionRecord,
  type TablesBundle,
} from "@/services/tables";

function revalidateTables() {
  revalidatePath(DASHBOARD_TABLES_PATH);
  revalidatePath(SETTINGS_TABLES_PATH);
}

export async function getTablesBundleAction(
  input: unknown,
): Promise<ActionResult<TablesBundle>> {
  try {
    const parsed = tablesBundleQuerySchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid tables request.",
      );
    }

    const bundle = await getTablesBundle(parsed.data.branchId);
    return actionOk(bundle);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to load tables.");
  }
}

export async function createTableAction(
  input: unknown,
): Promise<ActionResult<{ table: RestaurantTableRecord }>> {
  try {
    const parsed = createTableSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid table details.",
      );
    }

    const result = await createTable(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ table: result.table });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create table.");
  }
}

export async function updateTableAction(
  input: unknown,
): Promise<ActionResult<{ table: RestaurantTableRecord }>> {
  try {
    const parsed = updateTableSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid table details.",
      );
    }

    const result = await updateTable(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ table: result.table });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update table.");
  }
}

export async function updateTableStatusAction(
  input: unknown,
): Promise<ActionResult<{ table: RestaurantTableRecord }>> {
  try {
    const parsed = updateTableStatusSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid table status.",
      );
    }

    const result = await updateTableStatus(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ table: result.table });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update table status.");
  }
}

export async function deleteTableAction(
  input: unknown,
): Promise<ActionResult<{ table: RestaurantTableRecord }>> {
  try {
    const parsed = deleteTableSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid table.",
      );
    }

    const result = await deleteTable(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ table: result.table });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to delete table.");
  }
}

export async function createTableSectionAction(
  input: unknown,
): Promise<ActionResult<{ section: TableSectionRecord }>> {
  try {
    const parsed = createTableSectionSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid section details.",
      );
    }

    const result = await createTableSection(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ section: result.section });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create section.");
  }
}

export async function updateTableSectionAction(
  input: unknown,
): Promise<ActionResult<{ section: TableSectionRecord }>> {
  try {
    const parsed = updateTableSectionSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid section details.",
      );
    }

    const result = await updateTableSection(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ section: result.section });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update section.");
  }
}

export async function deleteTableSectionAction(
  input: unknown,
): Promise<ActionResult<{ section: TableSectionRecord }>> {
  try {
    const parsed = deleteTableSectionSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid section.",
      );
    }

    const result = await deleteTableSection(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ section: result.section });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to delete section.");
  }
}

export async function reorderTableSectionsAction(
  input: unknown,
): Promise<ActionResult<{ sections: TableSectionRecord[] }>> {
  try {
    const parsed = reorderTableSectionsSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid section order.",
      );
    }

    const result = await reorderTableSections(parsed.data);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateTables();
    return actionOk({ sections: result.sections });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to reorder sections.");
  }
}
