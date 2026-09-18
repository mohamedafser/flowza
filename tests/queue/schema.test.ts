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

describe("queue management schema", () => {
  it("adds table assignment, token helpers, and concurrency-safe RPCs", () => {
    const sql = readMigration("queue_management");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS table_id");
    expect(sql).toContain("queue_entries_active_table_unique");
    expect(sql).toContain("queue_enqueue_customer");
    expect(sql).toContain("queue_call_next");
    expect(sql).toContain("queue_transition_entry");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("SKIP LOCKED");
    expect(sql).toContain("format_queue_token");
    expect(sql).toContain("queue_business_date");
    expect(sql).toContain("can_transition_queue_status");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET status = 'OCCUPIED'");
    expect(sql).toContain("SET status = 'AVAILABLE'");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,200}USING\s*\(\s*true\s*\)/i,
    );
  });

  it("syncs table occupancy whenever a queue entry is seated or released", () => {
    const sql = readMigration("queue_table_occupy_on_seat");
    expect(sql).toContain("sync_restaurant_table_status_from_queue");
    expect(sql).toContain("queue_entries_sync_table_status");
    expect(sql).toContain("SET status = 'OCCUPIED'");
    expect(sql).toContain("SET status = 'AVAILABLE'");
    expect(sql).toContain("status = 'SEATED'");
  });

  it("tightens queue entry RLS to operational roles", () => {
    const sql = readMigration("queue_management");
    expect(sql).toContain("queue_entries_insert_operator");
    expect(sql).toContain("queue_entries_update_operator");
    expect(sql).toContain("OWNER");
    expect(sql).toContain("STAFF");
    expect(sql).toContain("has_restaurant_role");
  });
});
