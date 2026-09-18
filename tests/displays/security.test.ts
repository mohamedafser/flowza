import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasPermission } from "@/lib/auth/permissions";
import { createDisplaySchema } from "@/lib/validations/display";

describe("display management security", () => {
  it("does not expose public tokens through audit-sensitive key helpers", async () => {
    const { isSensitiveAuditKey } = await import("@/services/audit");
    expect(isSensitiveAuditKey("public_token")).toBe(true);
    expect(isSensitiveAuditKey("display_code")).toBe(false);
  });

  it("enforces manage permission separately from view", () => {
    expect(hasPermission("OWNER", "displays.manage")).toBe(true);
    expect(hasPermission("ADMIN", "displays.manage")).toBe(true);
    expect(hasPermission("STAFF", "displays.manage")).toBe(false);
  });

  it("rejects cross-tenant shaped payloads at the boundary", () => {
    const parsed = createDisplaySchema.safeParse({
      restaurantId: "not-uuid",
      branchId: "22222222-2222-2222-2222-222222222222",
      queueId: "55555555-5555-5555-5555-555555555555",
      name: "TV",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps the public display API route read-only", () => {
    const route = readFileSync(
      resolve(
        __dirname,
        "../../app/api/public/displays/[publicToken]/route.ts",
      ),
      "utf8",
    );
    expect(route).toContain("export async function GET");
    expect(route).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
  });
});
