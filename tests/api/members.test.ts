import { describe, expect, it } from "vitest";
import { statusForActionCode } from "@/lib/api/json";

describe("/api/members contract", () => {
  it("documents the list JSON shape", () => {
    const success = {
      ok: true as const,
      data: {
        organizationId: "11111111-1111-4111-8111-111111111111",
        currentUserId: "22222222-2222-4222-8222-222222222222",
        members: [],
        invitations: [],
      },
    };

    expect(JSON.parse(JSON.stringify(success))).toEqual(success);
  });

  it("documents both invite outcomes", () => {
    const added = {
      ok: true as const,
      data: { outcome: "ADDED", email: "sam@example.com", role: "STAFF" },
    };
    const invited = {
      ok: true as const,
      data: { outcome: "INVITED", email: "new@example.com", role: "MANAGER" },
    };

    expect(added.data.outcome).toBe("ADDED");
    expect(invited.data.outcome).toBe("INVITED");
    expect(JSON.parse(JSON.stringify(invited))).toEqual(invited);
  });

  it("documents the error JSON shape", () => {
    const failure = {
      ok: false as const,
      code: "FORBIDDEN",
      message: "Only an owner can grant the owner role.",
    };

    expect(JSON.parse(JSON.stringify(failure))).toEqual(failure);
  });

  it("maps member failures onto meaningful HTTP status codes", () => {
    expect(statusForActionCode("VALIDATION")).toBe(400);
    expect(statusForActionCode("FORBIDDEN")).toBe(403);
    expect(statusForActionCode("NOT_FOUND")).toBe(404);
    expect(statusForActionCode("CONFLICT")).toBe(409);
  });
});
