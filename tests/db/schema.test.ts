import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DATABASE_TABLES, type Database } from "@/types/database";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

describe("Phase 2 database foundation", () => {
  it("ships versioned migrations for schema and RLS", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    expect(files.some((f) => f.includes("initial_schema"))).toBe(true);
    expect(files.some((f) => f.includes("rls_policies"))).toBe(true);
    expect(files.some((f) => f.includes("restaurant_storage"))).toBe(true);
    expect(files.some((f) => f.includes("create_restaurant_rpc"))).toBe(true);
    expect(files.some((f) => f.includes("restaurant_settings_and_hours"))).toBe(
      true,
    );
    expect(files.some((f) => f.includes("customer_management"))).toBe(true);
    expect(files.some((f) => f.includes("queue_management"))).toBe(true);
    expect(files.some((f) => f.includes("public_queue_experience"))).toBe(true);
    expect(files.some((f) => f.includes("realtime_infrastructure"))).toBe(true);
    expect(files.some((f) => f.includes("tv_display"))).toBe(true);
  });

  it("includes development seed data without customer PII tables", () => {
    const seedPath = resolve(root, "supabase/seed.sql");
    expect(existsSync(seedPath)).toBe(true);
    const seed = readFileSync(seedPath, "utf8");
    expect(seed).toContain("Demo Restaurant");
    expect(seed).toContain("Demo Branch");
    expect(seed).toContain("Main Queue");
    expect(seed.toLowerCase()).not.toContain("insert into public.customers");
  });

  it("exposes typed table names matching the Phase 2 model", () => {
    expect(DATABASE_TABLES).toEqual([
      "profiles",
      "restaurants",
      "restaurant_members",
      "branches",
      "table_sections",
      "restaurant_tables",
      "customers",
      "queues",
      "queue_entries",
      "queue_events",
      "displays",
      "qr_codes",
      "reservations",
      "notifications",
      "subscriptions",
      "audit_logs",
      "restaurant_settings",
      "operating_hours",
      "operating_periods",
      "special_hours",
    ]);

    type PublicTables = keyof Database["public"]["Tables"];
    const _assert: PublicTables[] = [...DATABASE_TABLES];
    expect(_assert.length).toBe(20);
  });

  it("enables RLS in the policies migration", () => {
    const rlsFile = readdirSync(migrationsDir).find((f) =>
      f.includes("rls_policies"),
    );
    expect(rlsFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, rlsFile!), "utf8");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("is_restaurant_member");
    expect(sql).not.toMatch(/^\s*USING\s*\(\s*true\s*\)/im);
  });

  it("enables tenant-aware RLS on Phase 5 settings tables", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const settingsFile = files.find((f) =>
      f.includes("restaurant_settings_and_hours"),
    );
    expect(settingsFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, settingsFile!), "utf8");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("restaurant_settings_select_member");
    expect(sql).toContain("operating_hours_select_member");
    expect(sql).toContain("special_hours_select_member");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,200}USING\s*\(\s*true\s*\)/i,
    );
  });
});
