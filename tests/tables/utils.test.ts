import { describe, expect, it } from "vitest";
import {
  authorizeTableScope,
  canChangeTableStatus,
  canDeleteSection,
  canDeleteTables,
  canManageTableSections,
  canManageTables,
  canViewTables,
  compareTableNumbers,
  deriveTableStatistics,
  filterTables,
  groupTablesBySection,
  isDuplicateTableNumber,
  isValidTableStatusTransition,
  queryTables,
  reorderSectionIds,
  sortTables,
  tableDisplayName,
  tableStatusTone,
  type TableSectionRecord,
  type TableWithSection,
} from "@/lib/utils/tables";
import type { TableStatus } from "@/lib/validations/table";

function section(
  id: string,
  name: string,
  sortOrder: number,
  branchId = "branch-a",
): TableSectionRecord {
  return { id, branch_id: branchId, name, sort_order: sortOrder };
}

function table(
  partial: Partial<TableWithSection> & { id: string },
): TableWithSection {
  return {
    branch_id: "branch-a",
    section_id: null,
    table_number: partial.id,
    name: null,
    capacity: 2,
    status: "AVAILABLE",
    sort_order: 0,
    section: null,
    ...partial,
  };
}

const indoor = section("sec-in", "Indoor", 1);
const outdoor = section("sec-out", "Outdoor", 2);

const sample: TableWithSection[] = [
  table({
    id: "t1",
    table_number: "1",
    name: "Table 1",
    capacity: 2,
    status: "AVAILABLE",
    sort_order: 1,
    section_id: indoor.id,
    section: indoor,
  }),
  table({
    id: "t2",
    table_number: "2",
    name: "Table 2",
    capacity: 4,
    status: "OCCUPIED",
    sort_order: 2,
    section_id: indoor.id,
    section: indoor,
  }),
  table({
    id: "t3",
    table_number: "10",
    name: "Patio 1",
    capacity: 6,
    status: "CLEANING",
    sort_order: 3,
    section_id: outdoor.id,
    section: outdoor,
  }),
  table({
    id: "t4",
    table_number: "4",
    name: null,
    capacity: 8,
    status: "BLOCKED",
    sort_order: 4,
    section_id: null,
    section: null,
  }),
];

describe("table permissions", () => {
  it("lets staff view tables and change status", () => {
    expect(canViewTables("STAFF")).toBe(true);
    expect(canChangeTableStatus("STAFF")).toBe(true);
    expect(canManageTables("STAFF")).toBe(true);
    expect(canDeleteTables("STAFF")).toBe(false);
    expect(canManageTableSections("STAFF")).toBe(false);
  });

  it("lets managers configure, delete, and manage sections", () => {
    expect(canManageTables("MANAGER")).toBe(true);
    expect(canDeleteTables("MANAGER")).toBe(true);
    expect(canManageTableSections("MANAGER")).toBe(true);
    expect(canViewTables("OWNER")).toBe(true);
  });
});

describe("table statistics", () => {
  it("derives all cards from a single dataset", () => {
    expect(deriveTableStatistics(sample)).toEqual({
      total: 4,
      available: 1,
      occupied: 1,
      cleaning: 1,
      reserved: 0,
      blocked: 1,
    });
  });
});

describe("table filtering, search, and sorting", () => {
  it("filters by section", () => {
    const outdoorTables = filterTables(sample, { sectionId: outdoor.id });
    expect(outdoorTables.map((item) => item.id)).toEqual(["t3"]);
  });

  it("filters by status", () => {
    const available = filterTables(sample, { status: "AVAILABLE" });
    expect(available.map((item) => item.id)).toEqual(["t1"]);
  });

  it("combines section and status filters", () => {
    const result = filterTables(sample, {
      sectionId: indoor.id,
      status: "OCCUPIED",
    });
    expect(result.map((item) => item.id)).toEqual(["t2"]);
  });

  it("searches by table number and name without needing a request", () => {
    expect(
      filterTables(sample, { search: "patio" }).map((item) => item.id),
    ).toEqual(["t3"]);
    expect(
      filterTables(sample, { search: "10" }).map((item) => item.id),
    ).toEqual(["t3"]);
    expect(filterTables(sample, { search: "nope" })).toEqual([]);
  });

  it("sorts by table number using a stable numeric order", () => {
    expect(compareTableNumbers("2", "10")).toBeLessThan(0);
    const sorted = sortTables(sample, "table_number").map(
      (item) => item.table_number,
    );
    expect(sorted).toEqual(["1", "2", "4", "10"]);
  });

  it("sorts by capacity, section, and status", () => {
    expect(sortTables(sample, "capacity").map((item) => item.capacity)).toEqual(
      [2, 4, 6, 8],
    );
    expect(sortTables(sample, "status")[0]?.status).toBe("AVAILABLE");
    expect(sortTables(sample, "section")[0]?.section?.name).toBe("Indoor");
  });

  it("uses sort_order then table number as the default order", () => {
    const shuffled: TableWithSection[] = [
      sample[2]!,
      sample[0]!,
      sample[3]!,
      sample[1]!,
    ];
    expect(
      queryTables(shuffled, { sort: "default" }).map((item) => item.id),
    ).toEqual(["t1", "t2", "t3", "t4"]);
  });
});

describe("visual grouping and display", () => {
  it("groups tables by section and keeps unsectioned tables last", () => {
    const groups = groupTablesBySection(sample, [outdoor, indoor]);
    expect(groups.map((group) => group.section?.name ?? "none")).toEqual([
      "Indoor",
      "Outdoor",
      "none",
    ]);
  });

  it("falls back to Table {number} when no display name exists", () => {
    expect(tableDisplayName({ table_number: "4", name: null })).toBe("Table 4");
    expect(tableDisplayName({ table_number: "1", name: "Booth" })).toBe(
      "Booth",
    );
  });

  it("maps statuses to badge tones", () => {
    expect(tableStatusTone("AVAILABLE")).toBe("success");
    expect(tableStatusTone("OCCUPIED")).toBe("danger");
    expect(tableStatusTone("CLEANING")).toBe("warning");
  });
});

describe("status and deletion rules", () => {
  it("allows manual transitions between valid statuses", () => {
    const statuses: TableStatus[] = [
      "AVAILABLE",
      "OCCUPIED",
      "CLEANING",
      "RESERVED",
      "BLOCKED",
    ];
    for (const from of statuses) {
      for (const to of statuses) {
        expect(isValidTableStatusTransition(from, to)).toBe(true);
      }
    }
  });

  it("detects duplicate table numbers within a branch dataset", () => {
    expect(isDuplicateTableNumber(sample, "1")).toBe(true);
    expect(isDuplicateTableNumber(sample, "1", "t1")).toBe(false);
    expect(isDuplicateTableNumber(sample, "99")).toBe(false);
  });

  it("prevents unsafe section deletion until tables are reassigned", () => {
    expect(canDeleteSection(indoor.id, sample)).toBe(false);
    expect(canDeleteSection(indoor.id, sample, outdoor.id)).toBe(true);
    expect(canDeleteSection(indoor.id, sample, null)).toBe(true);
    expect(canDeleteSection("unused", sample)).toBe(true);
  });

  it("reorders section ids without mutating the original list", () => {
    const ids = ["a", "b", "c"];
    expect(reorderSectionIds(ids, 2, 0)).toEqual(["c", "a", "b"]);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("restaurant, branch, and section isolation", () => {
  it("rejects a claimed restaurant the user does not belong to", () => {
    expect(
      authorizeTableScope({
        membershipRestaurantId: "rest-a",
        branchRestaurantId: "rest-b",
        resourceBranchId: "branch-b",
        expectedBranchId: "branch-b",
      }),
    ).toEqual({ ok: false, reason: "restaurant" });
  });

  it("rejects a table that does not belong to the selected branch", () => {
    expect(
      authorizeTableScope({
        membershipRestaurantId: "rest-a",
        branchRestaurantId: "rest-a",
        resourceBranchId: "branch-b",
        expectedBranchId: "branch-a",
      }),
    ).toEqual({ ok: false, reason: "branch" });
  });

  it("rejects a section from another branch", () => {
    expect(
      authorizeTableScope({
        membershipRestaurantId: "rest-a",
        branchRestaurantId: "rest-a",
        resourceBranchId: "branch-a",
        expectedBranchId: "branch-a",
        sectionBranchId: "branch-b",
      }),
    ).toEqual({ ok: false, reason: "section" });
  });

  it("allows a table and section that both belong to the selected branch", () => {
    expect(
      authorizeTableScope({
        membershipRestaurantId: "rest-a",
        branchRestaurantId: "rest-a",
        resourceBranchId: "branch-a",
        expectedBranchId: "branch-a",
        sectionBranchId: "branch-a",
      }),
    ).toEqual({ ok: true });
  });
});
