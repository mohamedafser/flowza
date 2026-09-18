import { z } from "zod";

export const TABLE_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "CLEANING",
  "RESERVED",
  "BLOCKED",
] as const;

export type TableStatus = (typeof TABLE_STATUSES)[number];

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  CLEANING: "Cleaning",
  RESERVED: "Reserved",
  BLOCKED: "Blocked",
};

export const COMMON_TABLE_CAPACITIES = [1, 2, 4, 6, 8, 10] as const;

export const TABLE_SORT_FIELDS = [
  "default",
  "table_number",
  "capacity",
  "section",
  "status",
] as const;

export type TableSortField = (typeof TABLE_SORT_FIELDS)[number];

const uuid = (label: string) => z.string().uuid(`Invalid ${label}`);

export const tableNumberSchema = z
  .string()
  .trim()
  .min(1, "Table number is required")
  .max(32, "Table number is too long");

export const tableNameSchema = z
  .string()
  .trim()
  .max(80, "Table name is too long")
  .optional()
  .transform((value) => (value ? value : undefined));

export const tableCapacitySchema = z.coerce
  .number({ invalid_type_error: "Capacity must be a number" })
  .int("Capacity must be a whole number")
  .min(1, "Capacity must be at least 1")
  .max(999, "Capacity is too large");

export const tableStatusSchema = z.enum(TABLE_STATUSES, {
  errorMap: () => ({ message: "Invalid table status" }),
});

export const tableSortOrderSchema = z.coerce
  .number({ invalid_type_error: "Sort order must be a number" })
  .int("Sort order must be a whole number")
  .min(0, "Sort order cannot be negative")
  .max(10_000, "Sort order is too large");

export const sectionNameSchema = z
  .string()
  .trim()
  .min(1, "Section name is required")
  .max(80, "Section name is too long");

const optionalSectionId = z
  .union([z.string().uuid("Invalid section"), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const tableFieldsSchema = z.object({
  tableNumber: tableNumberSchema,
  name: z.string().trim().max(80, "Table name is too long"),
  sectionId: z.union([z.string().uuid("Invalid section"), z.literal("")]),
  capacity: tableCapacitySchema,
  status: tableStatusSchema,
  sortOrder: tableSortOrderSchema.optional(),
});

export type TableFormValues = z.infer<typeof tableFieldsSchema>;

export const createTableSchema = z.object({
  branchId: uuid("branch"),
  tableNumber: tableNumberSchema,
  name: z.string().trim().max(80, "Table name is too long").optional(),
  sectionId: optionalSectionId,
  capacity: tableCapacitySchema,
  status: tableStatusSchema.default("AVAILABLE"),
  sortOrder: tableSortOrderSchema.optional(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;

export const updateTableSchema = z.object({
  tableId: uuid("table"),
  tableNumber: tableNumberSchema,
  name: z.string().trim().max(80, "Table name is too long").optional(),
  sectionId: optionalSectionId,
  capacity: tableCapacitySchema,
  sortOrder: tableSortOrderSchema.optional(),
});

export type UpdateTableInput = z.infer<typeof updateTableSchema>;

export const updateTableStatusSchema = z.object({
  tableId: uuid("table"),
  status: tableStatusSchema,
});

export type UpdateTableStatusInput = z.infer<typeof updateTableStatusSchema>;

export const deleteTableSchema = z.object({
  tableId: uuid("table"),
});

export type DeleteTableInput = z.infer<typeof deleteTableSchema>;

export const createTableSectionSchema = z.object({
  branchId: uuid("branch"),
  name: sectionNameSchema,
});

export type CreateTableSectionInput = z.infer<typeof createTableSectionSchema>;

export const updateTableSectionSchema = z.object({
  sectionId: uuid("section"),
  name: sectionNameSchema,
});

export type UpdateTableSectionInput = z.infer<typeof updateTableSectionSchema>;

export const deleteTableSectionSchema = z.object({
  sectionId: uuid("section"),
  reassignToSectionId: z
    .union([z.string().uuid("Invalid section"), z.null()])
    .optional(),
});

export type DeleteTableSectionInput = z.infer<typeof deleteTableSectionSchema>;

export const reorderTableSectionsSchema = z.object({
  branchId: uuid("branch"),
  sectionIds: z
    .array(uuid("section"))
    .min(1, "At least one section is required"),
});

export type ReorderTableSectionsInput = z.infer<
  typeof reorderTableSectionsSchema
>;

export const tablesBundleQuerySchema = z.object({
  branchId: uuid("branch"),
});

export type TablesBundleQuery = z.infer<typeof tablesBundleQuerySchema>;

export function toTableWritePayload(
  values: Pick<
    TableFormValues,
    "tableNumber" | "name" | "sectionId" | "capacity" | "status" | "sortOrder"
  >,
) {
  const name =
    typeof values.name === "string" && values.name.trim() !== ""
      ? values.name.trim()
      : null;

  return {
    tableNumber: values.tableNumber,
    name,
    sectionId: values.sectionId === "" ? null : values.sectionId,
    capacity: values.capacity,
    status: values.status,
    sortOrder: values.sortOrder,
  };
}
