#!/usr/bin/env node
/**
 * Copies CLI-generated types into types/database.ts while preserving helpers.
 * Prefer: npm run db:types (requires `supabase start`).
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = resolve(root, "types/database.generated.ts");
const targetPath = resolve(root, "types/database.ts");

if (!existsSync(generatedPath)) {
  console.error(
    "Missing types/database.generated.ts — run supabase gen types first.",
  );
  process.exit(1);
}

const generated = readFileSync(generatedPath, "utf8").trimEnd();

const helpers = `
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/** Core application tables introduced in Phase 2. */
export const DATABASE_TABLES = [
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
] as const satisfies ReadonlyArray<keyof Database["public"]["Tables"]>;

export type DatabaseTableName = (typeof DATABASE_TABLES)[number];
`;

const header = `/**
 * Supabase Database types for Flowza.
 *
 * Regenerated via: npm run db:types
 * Do not hand-edit table/enum definitions — change migrations and regenerate.
 */

`;

writeFileSync(targetPath, `${header}${generated}\n${helpers}\n`);
unlinkSync(generatedPath);
console.log("Updated types/database.ts from Supabase CLI output.");
