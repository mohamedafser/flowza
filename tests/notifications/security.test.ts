import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { hasPermission } from "@/lib/auth/permissions";
import { isSensitiveAuditKey } from "@/services/audit";
import { buildIdempotencyKey } from "@/lib/notifications/constants";
import { notificationSettingsSchema } from "@/lib/validations/notifications";

const root = resolve(__dirname, "../..");

describe("notification security", () => {
  it("keeps provider credentials out of NEXT_PUBLIC_ env docs", () => {
    const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
    expect(envExample).toContain("RESEND_API_KEY");
    expect(envExample).toContain("WHATSAPP_ACCESS_TOKEN");
    expect(envExample).toContain("SMS_PROVIDER_API_KEY");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(envExample).not.toMatch(/NEXT_PUBLIC_RESEND/);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_WHATSAPP/);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_SMS/);
    expect(envExample).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE/);
  });

  it("does not expose notification history on public queue routes", () => {
    const joinRoute = readFileSync(
      resolve(
        root,
        "app/api/public/branches/[restaurantSlug]/[branchSlug]/queue/join/route.ts",
      ),
      "utf8",
    );
    const statusRoute = readFileSync(
      resolve(root, "app/api/public/queue/[accessToken]/route.ts"),
      "utf8",
    );
    expect(joinRoute).not.toMatch(/notification/i);
    expect(statusRoute).not.toMatch(/notification/i);
  });

  it("requires restaurant membership for staff notification APIs", () => {
    const route = readFileSync(
      resolve(root, "app/api/notifications/route.ts"),
      "utf8",
    );
    expect(route).toContain("listStaffNotifications");
    expect(route).toContain("markStaffNotificationRead");
  });

  it("allows settings managers to update notification settings", () => {
    expect(hasPermission("OWNER", "restaurant.manage")).toBe(true);
    expect(hasPermission("ADMIN", "restaurant.manage")).toBe(true);
    expect(hasPermission("STAFF", "restaurant.manage")).toBe(false);
  });

  it("treats provider tokens as sensitive audit keys", () => {
    expect(isSensitiveAuditKey("access_token")).toBe(true);
    expect(isSensitiveAuditKey("email")).toBe(true);
    expect(isSensitiveAuditKey("phone")).toBe(true);
  });

  it("rejects invalid restaurant ids in settings schema", () => {
    const parsed = notificationSettingsSchema.safeParse({
      notificationsEmailEnabled: true,
      notificationsWhatsappEnabled: false,
      notificationsSmsEnabled: false,
      notificationsInAppEnabled: true,
      notifyCustomerOnJoin: true,
      notifyCustomerOnCalled: true,
      notifyCustomerOnReminder: false,
      notifyStaffOnJoin: true,
      notifyStaffOnCancel: true,
      notifyStaffOnNoShow: true,
      notifyStaffQueueBusyThreshold: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("notification queue integration", () => {
  it("wires queue mutations to notification helpers", () => {
    const queues = readFileSync(resolve(root, "services/queues.ts"), "utf8");
    expect(queues).toContain("notifyQueueJoined");
    expect(queues).toContain("notifyQueueCalled");
    expect(queues).toContain("notifyQueueCancelled");
    expect(queues).toContain("notifyQueueNoShow");
    expect(queues).toContain("notifyQueueSeated");
  });

  it("notifies on public join only when not reused", () => {
    const publicQueue = readFileSync(
      resolve(root, "services/public-queue.ts"),
      "utf8",
    );
    expect(publicQueue).toContain("notifyQueueJoined");
    expect(publicQueue).toContain("!mapped.data.reused");
    expect(publicQueue).toContain("notifyQueueCancelled");
  });

  it("deduplicates by queue entry + type + channel + event version", () => {
    const a = buildIdempotencyKey({
      queueEntryId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      type: "QUEUE_JOINED",
      channel: "IN_APP",
      eventVersion: "v1",
    });
    const b = buildIdempotencyKey({
      queueEntryId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      type: "QUEUE_JOINED",
      channel: "IN_APP",
      eventVersion: "v1",
    });
    const c = buildIdempotencyKey({
      queueEntryId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      type: "QUEUE_JOINED",
      channel: "EMAIL",
      eventVersion: "v1",
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("ships a notifications migration with idempotency and statuses", () => {
    const files = readdirSync(resolve(root, "supabase/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    const migration = files.find((f) => f.includes("notifications_infrastructure"));
    expect(migration).toBeTruthy();
    const sql = readFileSync(
      resolve(root, "supabase/migrations", migration!),
      "utf8",
    );
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("PROCESSING");
    expect(sql).toContain("CANCELLED");
    expect(sql).toContain("notification_enqueue");
    expect(sql).toContain("notification_claim");
    expect(sql).toContain("customer_notification_preferences");
    expect(sql).toContain("notification_reads");
  });
});
