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
    expect(files.some((f) => f.includes("notifications_infrastructure"))).toBe(
      true,
    );
    expect(files.some((f) => f.includes("dashboard_analytics"))).toBe(true);
    expect(files.some((f) => f.includes("organization_tenancy"))).toBe(true);
    expect(files.some((f) => f.includes("subscription_billing"))).toBe(true);
    expect(files.some((f) => f.includes("platform_admin"))).toBe(true);
    expect(files.some((f) => f.includes("security_hardening"))).toBe(true);
  });

  it("includes development seed data without customer PII tables", () => {
    const seedPath = resolve(root, "supabase/seed.sql");
    expect(existsSync(seedPath)).toBe(true);
    const seed = readFileSync(seedPath, "utf8");
    expect(seed).toContain("Demo Restaurant");
    expect(seed).toContain("organizations");
    expect(seed).toContain("Demo Branch");
    expect(seed).toContain("Main Queue");
    expect(seed.toLowerCase()).not.toContain("insert into public.customers");
  });

  it("exposes typed table names matching the Phase 2 model", () => {
    expect(DATABASE_TABLES).toEqual([
      "profiles",
      "platform_settings",
      "organizations",
      "plans",
      "payments",
      "restaurants",
      "restaurant_members",
      "organization_invitations",
      "auth_otps",
      "password_reset_authorizations",
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
      "notification_reads",
      "customer_notification_preferences",
      "push_subscriptions",
      "subscriptions",
      "webhook_events",
      "audit_logs",
      "restaurant_settings",
      "operating_hours",
      "operating_periods",
      "special_hours",
    ]);

    type PublicTables = keyof Database["public"]["Tables"];
    const _assert: PublicTables[] = [...DATABASE_TABLES];
    expect(_assert.length).toBe(31);
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

  it("adds organization tenancy migration with org helpers and RLS", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const orgFile = files.find((f) => f.includes("organization_tenancy"));
    expect(orgFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, orgFile!), "utf8");
    expect(sql).toContain("CREATE TABLE public.organizations");
    expect(sql).toContain("is_organization_member");
    expect(sql).toContain("organization_id");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("adds organization member management RPCs", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const memberFile = files.find((f) => f.includes("organization_members"));
    expect(memberFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, memberFile!), "utf8");
    expect(sql).toContain("public.list_organization_members");
    expect(sql).toContain("public.add_organization_member");
    expect(sql).toContain("public.update_organization_member_role");
    expect(sql).toContain("public.remove_organization_member");
    expect(sql).toContain("MEMBER_LAST_OWNER");
    expect(sql).toContain("GRANT EXECUTE");
  });

  it("parks invitations for people without an account yet", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const inviteFile = files.find((f) =>
      f.includes("organization_invitations"),
    );
    expect(inviteFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, inviteFile!), "utf8");
    expect(sql).toContain("CREATE TABLE public.organization_invitations");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("public.invite_organization_member");
    expect(sql).toContain("public.revoke_organization_invitation");
    // Signing up with an invited email must grant the membership automatically.
    expect(sql).toContain("public.accept_pending_invitations");
    expect(sql).toContain("AFTER INSERT ON auth.users");
  });

  it("adds hashed auth OTP storage for signup and password reset", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const otpFile = files.find((f) => f.includes("auth_otps"));
    expect(otpFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, otpFile!), "utf8");
    expect(sql).toContain("CREATE TABLE public.auth_otps");
    expect(sql).toContain("otp_hash");
    expect(sql).toContain("password_reset_authorizations");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "GRANT ALL ON TABLE public.auth_otps TO service_role",
    );
  });
});
