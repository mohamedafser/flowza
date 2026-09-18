import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hasPermission } from "@/lib/auth/permissions";
import { isSensitiveAuditKey } from "@/services/audit";
import { createQRCodeSchema } from "@/lib/validations/qr-code";

describe("QR management security", () => {
  it("treats public tokens as sensitive audit metadata", () => {
    expect(isSensitiveAuditKey("public_token")).toBe(true);
    expect(isSensitiveAuditKey("token")).toBe(true);
    expect(isSensitiveAuditKey("name")).toBe(false);
  });

  it("separates view and manage permissions", () => {
    expect(hasPermission("MANAGER", "qr_codes.view")).toBe(true);
    expect(hasPermission("MANAGER", "qr_codes.manage")).toBe(true);
    expect(hasPermission("STAFF", "qr_codes.view")).toBe(true);
    expect(hasPermission("STAFF", "qr_codes.manage")).toBe(false);
  });

  it("rejects cross-tenant shaped payloads at the boundary", () => {
    const parsed = createQRCodeSchema.safeParse({
      restaurantId: "not-uuid",
      branchId: "22222222-2222-2222-2222-222222222222",
      queueId: "55555555-5555-5555-5555-555555555555",
      name: "Entrance",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps the public QR API route read-only", () => {
    const route = readFileSync(
      resolve(__dirname, "../../app/api/public/qr/[publicToken]/route.ts"),
      "utf8",
    );
    expect(route).toContain("export async function GET");
    expect(route).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
  });

  it("does not allow arbitrary destination URLs in create schema", () => {
    const schemaSource = readFileSync(
      resolve(__dirname, "../../lib/validations/qr-code.ts"),
      "utf8",
    );
    expect(schemaSource).not.toMatch(/url\(|z\.string\(\)\.url/);
    expect(schemaSource).toContain("branchId");
    expect(schemaSource).toContain("queueId");
  });
});
