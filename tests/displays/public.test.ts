import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectObjectKeys,
  toPublicDisplayData,
  type PublicDisplayRpc,
} from "@/lib/public-display/dto";
import { PUBLIC_DISPLAY_SENSITIVE_KEYS } from "@/lib/public-display/types";
import {
  isPublicDisplayPath,
  isValidPublicDisplayToken,
  publicDisplayPath,
} from "@/lib/public-display/paths";
import { isProtectedPath, isPublicAuthAssetPath } from "@/lib/auth/paths";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

function readMigration(namePart: string): string {
  const file = readdirSync(migrationsDir).find((entry) =>
    entry.includes(namePart),
  );
  expect(file).toBeTruthy();
  return readFileSync(resolve(migrationsDir, file!), "utf8");
}

const activeFixture: PublicDisplayRpc = {
  unavailable: false,
  display: { name: "Lobby TV", mode: "QUEUE" },
  restaurant: { name: "Demo Restaurant", logo_url: "/logo.png" },
  branch: { name: "Demo Branch" },
  queue: { name: "Main Queue", status: "ACTIVE", status_label: "Queue Open" },
  now_serving: { token: "A014" },
  next_tokens: [{ token: "A015" }, { token: "A016" }, { token: "A017" }],
  settings: {
    nextTokenCount: 3,
    showRestaurantLogo: true,
    showBranchName: true,
    showQueueName: true,
    theme: "dark",
    preferFullscreen: false,
  },
  realtime_channel:
    "restaurant:11111111-1111-1111-1111-111111111111:queue:55555555-5555-5555-5555-555555555555",
};

describe("public display DTO", () => {
  it("maps an active queue display without PII fields", () => {
    const mapped = toPublicDisplayData(activeFixture);
    expect(mapped.unavailable).toBe(false);
    if (mapped.unavailable) return;
    expect(mapped.nowServing?.token).toBe("A014");
    expect(mapped.nextTokens.map((entry) => entry.token)).toEqual([
      "A015",
      "A016",
      "A017",
    ]);
    expect(mapped.queue.statusLabel).toBe("Queue Open");
    expect(mapped.realtimeChannel).toContain(":queue:");

    const keys = [...collectObjectKeys(mapped)].map((key) =>
      key.toLowerCase().replace(/[_-]/g, ""),
    );
    for (const sensitive of PUBLIC_DISPLAY_SENSITIVE_KEYS) {
      expect(keys).not.toContain(sensitive.replace(/[_-]/g, ""));
    }
    expect(JSON.stringify(mapped)).not.toMatch(/phone|email|customer/i);
  });

  it("handles inactive and missing queue states", () => {
    expect(
      toPublicDisplayData({ unavailable: true, reason: "inactive" }),
    ).toMatchObject({ unavailable: true, reason: "inactive" });
    expect(
      toPublicDisplayData({
        unavailable: true,
        reason: "queue_unavailable",
      }),
    ).toMatchObject({ unavailable: true, reason: "queue_unavailable" });
  });

  it("clears misleading next/serving payloads for closed queues without a called token", () => {
    const mapped = toPublicDisplayData({
      ...activeFixture,
      queue: {
        name: "Main Queue",
        status: "CLOSED",
        status_label: "Queue Closed",
      },
      now_serving: null,
      next_tokens: [],
    });
    expect(mapped.unavailable).toBe(false);
    if (mapped.unavailable) return;
    expect(mapped.nowServing).toBeNull();
    expect(mapped.nextTokens).toEqual([]);
    expect(mapped.queue.statusLabel).toBe("Queue Closed");
  });

  it("maps paused queue status labels", () => {
    const mapped = toPublicDisplayData({
      ...activeFixture,
      queue: {
        name: "Main Queue",
        status: "PAUSED",
        status_label: "Queue Temporarily Paused",
      },
    });
    expect(mapped.unavailable).toBe(false);
    if (mapped.unavailable) return;
    expect(mapped.queue.statusLabel).toBe("Queue Temporarily Paused");
  });

  it("rejects unsafe realtime channels", () => {
    const mapped = toPublicDisplayData({
      ...activeFixture,
      realtime_channel: "restaurant:x:customer:secret-token",
    });
    expect(mapped.unavailable).toBe(false);
    if (mapped.unavailable) return;
    expect(mapped.realtimeChannel).toBeNull();
  });
});

describe("public display routes and tokens", () => {
  it("keeps display routes public and unauthenticated", () => {
    const path = publicDisplayPath("a".repeat(43));
    expect(isProtectedPath(path)).toBe(false);
    expect(isPublicAuthAssetPath(path)).toBe(true);
    expect(isPublicAuthAssetPath("/api/public/displays/token")).toBe(true);
    expect(isPublicDisplayPath(path)).toBe(true);
  });

  it("validates secure public tokens", () => {
    expect(isValidPublicDisplayToken("a".repeat(43))).toBe(true);
    expect(isValidPublicDisplayToken("short")).toBe(false);
    expect(isValidPublicDisplayToken("x".repeat(80))).toBe(false);
    expect(isValidPublicDisplayToken("bad token with spaces!!!!")).toBe(false);
  });
});

describe("display schema migration", () => {
  it("extends displays with public token, queue, and settings", () => {
    const sql = readMigration("tv_display");
    expect(sql).toContain("public_token");
    expect(sql).toContain("queue_id");
    expect(sql).toContain("settings");
    expect(sql).toContain("generate_display_public_token");
    expect(sql).toContain("get_public_display");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_public_display",
    );
    expect(sql).toContain("status = 'CALLED'");
    expect(sql).toContain("status = 'WAITING'");
    expect(sql).not.toMatch(/customer_id|phone|email/i);
    expect(sql).toContain("queue_realtime_topic");
  });
});
