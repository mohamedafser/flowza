import { describe, expect, it } from "vitest";

describe("POST /api/restaurants contract", () => {
  it("documents the success JSON shape", () => {
    const success = {
      ok: true as const,
      data: {
        restaurantId: "11111111-1111-1111-1111-111111111111",
        redirectTo: "/dashboard/overview",
      },
    };

    expect(JSON.parse(JSON.stringify(success))).toEqual(success);
    expect(success.ok).toBe(true);
    expect(success.data.redirectTo).toBe("/dashboard/overview");
  });

  it("documents the error JSON shape", () => {
    const failure = {
      ok: false as const,
      code: "VALIDATION",
      message: "Restaurant name must be at least 2 characters",
    };

    expect(JSON.parse(JSON.stringify(failure))).toEqual(failure);
    expect(failure.ok).toBe(false);
  });
});
