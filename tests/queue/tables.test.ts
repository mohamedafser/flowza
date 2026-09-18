import { describe, expect, it } from "vitest";
import { authorizeQueueScope, suitableTablesForParty } from "@/lib/utils/queue";
import type { RestaurantTableRecord } from "@/lib/utils/tables";

function table(
  partial: Partial<RestaurantTableRecord> & { id: string },
): RestaurantTableRecord {
  return {
    branch_id: "branch-a",
    section_id: null,
    table_number: partial.id,
    name: null,
    capacity: 2,
    status: "AVAILABLE",
    sort_order: 0,
    ...partial,
  };
}

describe("table assignment helpers", () => {
  const tables = [
    table({ id: "t2", table_number: "2", capacity: 2, sort_order: 2 }),
    table({ id: "t4", table_number: "4", capacity: 4, sort_order: 1 }),
    table({
      id: "t6",
      table_number: "6",
      capacity: 6,
      status: "OCCUPIED",
      sort_order: 3,
    }),
    table({
      id: "t8",
      table_number: "8",
      capacity: 8,
      branch_id: "branch-b",
      sort_order: 4,
    }),
  ];

  it("prefers the smallest available table that fits the party", () => {
    const suitable = suitableTablesForParty(tables, 3);
    expect(suitable.map((item) => item.id)).toEqual(["t4", "t8"]);
    expect(suitable[0]?.capacity).toBe(4);
  });

  it("excludes occupied tables even when capacity is enough", () => {
    expect(suitableTablesForParty(tables, 5).map((item) => item.id)).toEqual([
      "t8",
    ]);
  });

  it("treats only AVAILABLE tables as assignable for seating", () => {
    const available = tables.filter((item) => item.status === "AVAILABLE");
    expect(available.every((item) => item.status === "AVAILABLE")).toBe(true);
    expect(
      suitableTablesForParty(
        [
          ...tables,
          table({
            id: "t10",
            table_number: "10",
            capacity: 10,
            status: "CLEANING",
          }),
        ],
        2,
      ).map((item) => item.id),
    ).toEqual(["t2", "t4", "t8"]);
  });

  it("rejects a table from another branch", () => {
    const scoped = authorizeQueueScope({
      membershipRestaurantId: "rest-a",
      queueRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
      tableBranchId: "branch-b",
    });
    expect(scoped).toEqual({ ok: false, reason: "table" });
  });

  it("keeps restaurant and branch isolation", () => {
    expect(
      authorizeQueueScope({
        membershipRestaurantId: "rest-a",
        queueRestaurantId: "rest-b",
        currentRestaurantId: "rest-b",
        queueBranchId: "branch-b",
        expectedBranchId: "branch-b",
      }).ok,
    ).toBe(false);

    expect(
      authorizeQueueScope({
        membershipRestaurantId: "rest-a",
        queueRestaurantId: "rest-a",
        currentRestaurantId: "rest-a",
        queueBranchId: "branch-b",
        expectedBranchId: "branch-a",
      }),
    ).toEqual({ ok: false, reason: "branch" });
  });
});
