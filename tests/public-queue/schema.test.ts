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

describe("public queue schema", () => {
  it("adds a unique public access token and reuses the Phase 8 enqueue helper", () => {
    const sql = readMigration("public_queue_experience");
    expect(sql).toContain("public_access_token");
    expect(sql).toContain("queue_entries_public_access_token_key");
    expect(sql).toContain("gen_random_bytes(32)");
    expect(sql).toContain("queue_insert_waiting_entry");
    expect(sql).toContain("queue_enqueue_customer");
    expect(sql).toContain("format_queue_token");
    expect(sql).toContain("queue_join_public");
    expect(sql).toContain("get_public_queue_info");
    expect(sql).toContain("get_public_queue_status");
    expect(sql).toContain("cancel_public_queue_entry");
    expect(sql).toContain("queue_entries_active_customer_unique");
    expect(sql).toContain("customers_restaurant_phone_unique");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_public_queue_info",
    );
    expect(sql).toContain("TO anon, authenticated");
  });

  it("does not open anonymous table policies on customers or queue entries", () => {
    const sql = readMigration("public_queue_experience");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,400}ON public\.queue_entries[\s\S]{0,200}USING\s*\(\s*true\s*\)/i,
    );
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,400}ON public\.customers[\s\S]{0,200}USING\s*\(\s*true\s*\)/i,
    );
    expect(sql).toContain("No anonymous SELECT");
    expect(sql).toContain("SECURITY DEFINER");
  });
});
