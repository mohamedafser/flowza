import { existsSync, readFileSync, readdirSync } from "node:fs";
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

describe("table schema and RLS", () => {
  it("keeps unique table numbers, positive capacity, and shared-branch sections", () => {
    const sql = readMigration("initial_schema");
    expect(sql).toContain("restaurant_tables_branch_number_unique");
    expect(sql).toContain("restaurant_tables_capacity_positive");
    expect(sql).toContain("table_sections_branch_name_unique");
    expect(sql).toContain("table_status");
    expect(sql).toContain("AVAILABLE");
    expect(sql).toContain("OCCUPIED");
    expect(sql).toContain("CLEANING");
    expect(sql).toContain("RESERVED");
    expect(sql).toContain("BLOCKED");
    expect(sql).toContain("enforce_table_section_branch");
    expect(sql).toContain("ON DELETE SET NULL");
  });

  it("enforces tenant-aware RLS on tables and sections", () => {
    const sql = readMigration("rls_policies");
    expect(sql).toContain("table_sections_select_member");
    expect(sql).toContain("restaurant_tables_select_member");
    expect(sql).toContain("is_branch_member");
    expect(sql).toContain("restaurant_tables_delete_manager_up");
    expect(sql).toContain("table_sections_delete_manager_up");
    expect(sql).not.toMatch(
      /CREATE POLICY\s+"restaurant_tables[\s\S]{0,240}USING\s*\(\s*true\s*\)/i,
    );
    expect(sql).not.toMatch(
      /CREATE POLICY\s+"table_sections[\s\S]{0,240}USING\s*\(\s*true\s*\)/i,
    );
  });

  it("seeds demo tables without customer PII", () => {
    const seedPath = resolve(root, "supabase/seed.sql");
    expect(existsSync(seedPath)).toBe(true);
    const seed = readFileSync(seedPath, "utf8");
    expect(seed).toContain("table_sections");
    expect(seed).toContain("restaurant_tables");
    expect(seed).toContain("Indoor");
    expect(seed).toContain("Outdoor");
  });
});
