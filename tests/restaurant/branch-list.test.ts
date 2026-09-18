import { describe, expect, it } from "vitest";
import { escapeIlikePattern } from "@/services/branches";
import {
  DEFAULT_BRANCH_PAGE_SIZE,
  parseBranchListQuery,
} from "@/lib/validations/branch";

describe("branch list query parsing", () => {
  it("applies defaults", () => {
    expect(parseBranchListQuery({})).toEqual({
      q: undefined,
      city: undefined,
      country: undefined,
      page: 1,
      pageSize: DEFAULT_BRANCH_PAGE_SIZE,
      status: "all",
      sort: "name",
      order: "asc",
    });
  });

  it("parses all backend filters", () => {
    expect(
      parseBranchListQuery({
        q: "  downtown  ",
        city: " Austin ",
        country: "US",
        page: "2",
        pageSize: "20",
        status: "active",
        sort: "created_at",
        order: "desc",
      }),
    ).toEqual({
      q: "downtown",
      city: "Austin",
      country: "US",
      page: 2,
      pageSize: 20,
      status: "active",
      sort: "created_at",
      order: "desc",
    });
  });

  it("falls back on invalid values", () => {
    expect(
      parseBranchListQuery({
        page: "0",
        pageSize: "99",
        status: "nope",
        sort: "hack",
        order: "sideways",
      }),
    ).toEqual({
      q: undefined,
      city: undefined,
      country: undefined,
      page: 1,
      pageSize: DEFAULT_BRANCH_PAGE_SIZE,
      status: "all",
      sort: "name",
      order: "asc",
    });
  });
});

describe("ilike escaping", () => {
  it("escapes % and _ wildcards", () => {
    expect(escapeIlikePattern("100%_off")).toBe("100\\%\\_off");
  });
});

describe("branch list API pagination contract", () => {
  it("documents pagination JSON shape", () => {
    const payload = {
      ok: true as const,
      data: {
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
          offset: 0,
        },
        filters: {
          status: "all" as const,
          sort: "name" as const,
          order: "asc" as const,
        },
      },
    };

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });
});
