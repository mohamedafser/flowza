import { describe, expect, it } from "vitest";
import { getPaginationItems } from "@/components/common/Pagination";

describe("getPaginationItems", () => {
  it("returns all pages when total is small", () => {
    expect(getPaginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("includes ellipsis for larger ranges", () => {
    expect(getPaginationItems(1, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis", 12]);
    expect(getPaginationItems(6, 12)).toEqual([
      1,
      "ellipsis",
      5,
      6,
      7,
      "ellipsis",
      12,
    ]);
    expect(getPaginationItems(12, 12)).toEqual([
      1,
      "ellipsis",
      8,
      9,
      10,
      11,
      12,
    ]);
  });

  it("handles single page", () => {
    expect(getPaginationItems(1, 1)).toEqual([1]);
    expect(getPaginationItems(1, 0)).toEqual([]);
  });
});
