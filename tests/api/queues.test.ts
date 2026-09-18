import { describe, expect, it } from "vitest";
import { jsonFail, jsonOk, statusForActionCode } from "@/lib/api/json";

describe("queue mutation API contract", () => {
  it("returns 201 JSON when a queue is created", async () => {
    const response = jsonOk(
      { queue: { id: "55555555-5555-5555-5555-555555555555" } },
      201,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { queue: { id: "55555555-5555-5555-5555-555555555555" } },
    });
  });

  it("returns 201 JSON when a customer is added to a queue", async () => {
    const response = jsonOk({ entry: { token: "A001" } }, 201);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { entry: { token: "A001" } },
    });
  });

  it("returns JSON errors with matching HTTP status codes", async () => {
    const cases = [
      { code: "VALIDATION" as const, status: 400 },
      { code: "FORBIDDEN" as const, status: 403 },
      { code: "NOT_FOUND" as const, status: 404 },
      { code: "CONFLICT" as const, status: 409 },
      { code: "UNKNOWN" as const, status: 500 },
    ];

    for (const { code, status } of cases) {
      expect(statusForActionCode(code)).toBe(status);
      const response = jsonFail(code, "Unable to update the queue.", status);
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        code,
        message: "Unable to update the queue.",
      });
    }
  });
});
