import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { hasPermission } from "@/lib/auth/permissions";
import { canExportAnalytics, canViewAnalytics } from "@/lib/utils/analytics";
import {
  analyticsExportSchema,
  analyticsQuerySchema,
} from "@/lib/validations/analytics";

const root = resolve(__dirname, "../..");

describe("analytics security helpers", () => {
  it("gates analytics view and export by permission", () => {
    expect(canViewAnalytics("OWNER")).toBe(true);
    expect(canViewAnalytics("ADMIN")).toBe(true);
    expect(canViewAnalytics("MANAGER")).toBe(true);
    expect(canViewAnalytics("STAFF")).toBe(false);
    expect(canExportAnalytics("STAFF")).toBe(false);
    expect(hasPermission("STAFF", "queue.view")).toBe(true);
    expect(hasPermission("STAFF", "analytics.view")).toBe(false);
  });

  it("validates analytics query inputs", () => {
    const ok = analyticsQuerySchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      preset: "today",
    });
    expect(ok.success).toBe(true);

    const customMissing = analyticsQuerySchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      preset: "custom",
    });
    expect(customMissing.success).toBe(false);

    const exportOk = analyticsExportSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      preset: "last_7_days",
      kind: "queue_summary",
    });
    expect(exportOk.success).toBe(true);
  });

  it("keeps analytics routes private and audited exports", () => {
    const dashboardRoute = readFileSync(
      resolve(root, "app/api/analytics/dashboard/route.ts"),
      "utf8",
    );
    const exportRoute = readFileSync(
      resolve(root, "app/api/analytics/export/route.ts"),
      "utf8",
    );
    const exportService = readFileSync(
      resolve(root, "services/analytics/export.ts"),
      "utf8",
    );
    const access = readFileSync(
      resolve(root, "services/analytics/access.ts"),
      "utf8",
    );

    expect(dashboardRoute).toContain("requireVerifiedAuth");
    expect(exportRoute).toContain("requireVerifiedAuth");
    expect(exportService).toContain("analytics.exported");
    expect(exportService).toContain("permissions.canViewAnalytics");
    expect(access).toContain("requirePermission");
    expect(access).toContain("active restaurant");
  });

  it("ships analytics index migration", () => {
    const migrationsDir = resolve(root, "supabase/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const analyticsFile = files.find((f) => f.includes("dashboard_analytics"));
    expect(analyticsFile).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, analyticsFile!), "utf8");
    expect(sql).toContain("queue_entries_queue_business_joined_idx");
    expect(sql).toContain("reservations_branch_date_created_idx");
    expect(sql).toContain("audit_logs_restaurant_action_created_idx");
  });

  it("does not expose PII fields in analytics clients", () => {
    const queueService = readFileSync(
      resolve(root, "services/analytics/queue.ts"),
      "utf8",
    );
    const customerService = readFileSync(
      resolve(root, "services/analytics/customers.ts"),
      "utf8",
    );
    expect(queueService).not.toMatch(/\bphone\b/);
    expect(queueService).not.toMatch(/\bemail\b/);
    expect(customerService).toContain('select("id")');
    expect(customerService).not.toMatch(/\bphone\b/);
    expect(customerService).not.toMatch(/\bemail\b/);
  });
});
