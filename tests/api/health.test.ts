import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns ok status", async () => {
    const response = GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string };
    expect(body).toEqual({ status: "ok" });
  });
});
