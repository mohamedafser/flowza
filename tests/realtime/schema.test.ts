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

describe("realtime infrastructure schema", () => {
  it("adds required tables to supabase_realtime without recreating them", () => {
    const sql = readMigration("realtime_infrastructure");
    expect(sql).toContain("add_table_to_realtime_publication");
    expect(sql).toContain("pg_publication_tables");
    expect(sql).toContain("public.queue_entries");
    expect(sql).toContain("public.queue_events");
    expect(sql).toContain("public.queues");
    expect(sql).toContain("public.restaurant_tables");
    expect(sql).toContain("REPLICA IDENTITY FULL");
    expect(sql).toContain("realtime.send");
    expect(sql).toContain("queue_changed");
    expect(sql).toContain("jsonb_build_object('source', v_source)");
    expect(sql).not.toContain("ADD TABLE public.customers");
    expect(sql).toContain("customers is intentionally NOT added");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,240}USING\s*\(\s*true\s*\)/i,
    );
    expect(sql).not.toContain("CREATE TABLE public.queue_entries");
  });

  it("does not put access tokens or customer PII in broadcast payloads", () => {
    const sql = readMigration("realtime_infrastructure");
    expect(sql).toContain("realtime_channel");
    expect(sql).toContain("queue_realtime_topic");
    expect(sql).not.toMatch(
      /realtime\.send\([\s\S]{0,200}public_access_token/i,
    );
    expect(sql).not.toMatch(/realtime\.send\([\s\S]{0,200}\bphone\b/i);
    expect(sql).not.toMatch(/realtime\.send\([\s\S]{0,200}\bemail\b/i);
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.broadcast_queue_realtime_signal() TO PUBLIC",
    );
    expect(sql).toContain(
      "'restaurant:' || v_restaurant_id::text || ':queue:'",
    );
  });

  it("repairs trigger execute so queue inserts cannot be aborted", () => {
    const sql = readMigration("realtime_trigger_grants");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.broadcast_queue_realtime_signal() TO PUBLIC",
    );
    expect(sql).toContain("WHEN OTHERS");
    expect(sql).toContain("queue_insert_waiting_entry");
    expect(sql).toContain("generate_queue_access_token");
    expect(sql).toContain("SET search_path = public, extensions");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(sql).not.toContain("TO anon");
  });
});
