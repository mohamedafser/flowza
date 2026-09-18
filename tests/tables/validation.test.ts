import { describe, expect, it } from "vitest";
import {
  createTableSchema,
  createTableSectionSchema,
  deleteTableSectionSchema,
  reorderTableSectionsSchema,
  tableCapacitySchema,
  tableFieldsSchema,
  tableNumberSchema,
  tableStatusSchema,
  updateTableSchema,
  updateTableSectionSchema,
  updateTableStatusSchema,
} from "@/lib/validations/table";

const branchId = "22222222-2222-2222-2222-222222222222";
const tableId = "44444444-4444-4444-4444-444444444401";
const sectionId = "33333333-3333-3333-3333-333333333301";

describe("table validation", () => {
  it("accepts a valid create payload with default available status", () => {
    const parsed = createTableSchema.safeParse({
      branchId,
      tableNumber: "12",
      name: "Window booth",
      sectionId,
      capacity: 4,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("AVAILABLE");
      expect(parsed.data.sectionId).toBe(sectionId);
    }
  });

  it("requires a table number and a reasonable maximum length", () => {
    expect(tableNumberSchema.safeParse("").success).toBe(false);
    expect(tableNumberSchema.safeParse("   ").success).toBe(false);
    expect(tableNumberSchema.safeParse("A".repeat(33)).success).toBe(false);
    expect(tableNumberSchema.safeParse("Patio-1").success).toBe(true);
  });

  it("requires capacity to be a positive integer", () => {
    expect(tableCapacitySchema.safeParse(0).success).toBe(false);
    expect(tableCapacitySchema.safeParse(-2).success).toBe(false);
    expect(tableCapacitySchema.safeParse(1.5).success).toBe(false);
    expect(tableCapacitySchema.safeParse(1).success).toBe(true);
    expect(tableCapacitySchema.safeParse(10).success).toBe(true);
    expect(tableCapacitySchema.safeParse(999).success).toBe(true);
    expect(tableCapacitySchema.safeParse(1000).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(tableStatusSchema.safeParse("AVAILABLE").success).toBe(true);
    expect(tableStatusSchema.safeParse("SEATED").success).toBe(false);
    expect(
      updateTableStatusSchema.safeParse({ tableId, status: "CLEANING" })
        .success,
    ).toBe(true);
  });

  it("treats an empty section as unassigned on create", () => {
    const parsed = createTableSchema.safeParse({
      branchId,
      tableNumber: "1",
      name: "",
      sectionId: "",
      capacity: 2,
      status: "AVAILABLE",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sectionId).toBeNull();
    }

    const form = tableFieldsSchema.safeParse({
      tableNumber: "1",
      name: "",
      sectionId: "",
      capacity: 2,
      status: "AVAILABLE",
    });
    expect(form.success).toBe(true);
    if (form.success) {
      expect(form.data.sectionId).toBe("");
    }
  });

  it("rejects a table update that changes identity with an invalid id", () => {
    expect(
      updateTableSchema.safeParse({
        tableId: "not-a-uuid",
        tableNumber: "1",
        capacity: 2,
      }).success,
    ).toBe(false);
  });

  it("does not accept a branch id on the edit schema", () => {
    const parsed = updateTableSchema.safeParse({
      tableId,
      tableNumber: "1",
      capacity: 4,
      sectionId: null,
      sortOrder: 3,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("branchId" in parsed.data).toBe(false);
    }
  });
});

describe("section validation", () => {
  it("accepts a named section", () => {
    const parsed = createTableSectionSchema.safeParse({
      branchId,
      name: "Rooftop",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a blank section name", () => {
    expect(
      createTableSectionSchema.safeParse({ branchId, name: "  " }).success,
    ).toBe(false);
    expect(
      updateTableSectionSchema.safeParse({ sectionId, name: "" }).success,
    ).toBe(false);
  });

  it("allows deleting a section with an explicit reassignment", () => {
    expect(deleteTableSectionSchema.safeParse({ sectionId }).success).toBe(
      true,
    );
    expect(
      deleteTableSectionSchema.safeParse({
        sectionId,
        reassignToSectionId: null,
      }).success,
    ).toBe(true);
    expect(
      deleteTableSectionSchema.safeParse({
        sectionId,
        reassignToSectionId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("requires a complete section order", () => {
    expect(
      reorderTableSectionsSchema.safeParse({
        branchId,
        sectionIds: [sectionId],
      }).success,
    ).toBe(true);
    expect(
      reorderTableSectionsSchema.safeParse({
        branchId,
        sectionIds: [],
      }).success,
    ).toBe(false);
  });
});
