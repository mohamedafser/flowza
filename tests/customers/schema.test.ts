import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

function readMigration(namePart: string): string {
  const file = readdirSync(migrationsDir).find((entry) =>
    entry.includes(namePart),
  );
  expect(file).toBeTruthy();
  return readFileSync(resolve(migrationsDir, file!), "utf8");
}

describe("customer schema and RLS", () => {
  it("keeps customers restaurant-scoped without global phone or email uniqueness", () => {
    const sql = readMigration("initial_schema");
    expect(sql).toContain("CREATE TABLE public.customers");
    expect(sql).toContain("restaurant_id uuid NOT NULL");
    expect(sql).toContain("name text NOT NULL");
    expect(sql).toContain("customers_restaurant_id_idx");
    expect(sql).toContain("customers_phone_idx");
    expect(sql).toContain("customers_email_idx");
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX[\s\S]{0,80}customers.*phone/i);
    expect(sql).not.toMatch(
      /CONSTRAINT customers_phone_unique|UNIQUE\s*\(\s*phone\s*\)/i,
    );
  });

  it("adds name constraints and a created_at lookup index", () => {
    const sql = readMigration("customer_management");
    expect(sql).toContain("customers_name_not_blank");
    expect(sql).toContain("customers_created_at_idx");
    expect(sql).toContain("restaurant_id, created_at DESC");
  });

  it("enforces tenant-aware RLS without USING (true)", () => {
    const rls = readMigration("rls_policies");
    expect(rls).toContain("customers_select_member");
    expect(rls).toContain("is_restaurant_member(restaurant_id)");
    expect(rls).not.toMatch(
      /CREATE POLICY\s+"customers[\s\S]{0,240}USING\s*\(\s*true\s*\)/i,
    );

    const management = readMigration("customer_management");
    expect(management).toContain("customers_insert_manager_up");
    expect(management).toContain("customers_update_manager_up");
    expect(management).toContain("OWNER");
    expect(management).toContain("ADMIN");
    expect(management).toContain("MANAGER");
    expect(management).not.toMatch(
      /CREATE POLICY[\s\S]{0,240}USING\s*\(\s*true\s*\)/i,
    );

    const queueOperators = readMigration("customers_insert_queue_operators");
    expect(queueOperators).toContain("customers_insert_operator");
    expect(queueOperators).toContain("STAFF");
    expect(queueOperators).toContain(
      'DROP POLICY IF EXISTS "customers_insert_manager_up"',
    );
  });

  it("does not cache customer pages or APIs in the PWA runtime", () => {
    const config = readFileSync(resolve(root, "next.config.ts"), "utf8");
    expect(config).toContain('url.pathname.includes("/customers")');
    expect(config).toContain("NetworkOnly");
  });
});
