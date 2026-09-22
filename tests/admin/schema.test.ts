import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

describe("Phase 17 platform admin migration", () => {
  const sql = (() => {
    const file = readdirSync(migrationsDir).find((f) =>
      f.includes("platform_admin"),
    );
    expect(file).toBeTruthy();
    return readFileSync(resolve(migrationsDir, file!), "utf8");
  })();

  it("adds SUPER_ADMIN platform role without restaurant member roles", () => {
    expect(sql).toContain("CREATE TYPE public.platform_role AS ENUM");
    expect(sql).toContain("SUPER_ADMIN");
    expect(sql).not.toContain("ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'");
    expect(sql).toContain("platform_role public.platform_role");
    expect(sql).toContain("account_status public.account_status");
  });

  it("creates platform_settings with RLS enabled and no open policies", () => {
    expect(sql).toContain("CREATE TABLE public.platform_settings");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("maintenance_mode");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,200}ON public\.platform_settings/i,
    );
  });

  it("exposes is_platform_super_admin helper", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_platform_super_admin");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.is_platform_super_admin");
  });

  it("allows nullable restaurant_id on audit_logs for platform events", () => {
    expect(sql).toContain("ALTER COLUMN restaurant_id DROP NOT NULL");
  });
});
