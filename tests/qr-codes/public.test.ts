import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isProtectedPath, isPublicAuthAssetPath } from "@/lib/auth/paths";
import { parsePublicQRRpc, toPublicQRData } from "@/lib/public-qr/dto";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import {
  isPublicQRPath,
  isValidPublicQRToken,
  publicQRCodePath,
} from "@/lib/public-qr/paths";
import { PUBLIC_QR_SENSITIVE_KEYS } from "@/lib/public-qr/types";
import {
  getPublicDisplayUrl,
  getPublicQRCodeUrl,
  getPublicQueueJoinUrl,
  getPublicQueueStatusUrl,
} from "@/lib/utils/public-urls";
import {
  generateQRCodePngDataUrl,
  generateQRCodeSvg,
  sanitizeQRFilename,
} from "@/lib/qr/generate";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

function readMigration(namePart: string): string {
  const file = readdirSync(migrationsDir).find((entry) =>
    entry.includes(namePart),
  );
  expect(file).toBeTruthy();
  return readFileSync(resolve(migrationsDir, file!), "utf8");
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

describe("public QR URLs", () => {
  it("builds join/status/display/QR absolute URLs from the app origin", () => {
    const join = getPublicQueueJoinUrl({
      restaurantSlug: "demo-restaurant",
      branchSlug: "main-branch",
    });
    expect(join).toMatch(/\/queue\/demo-restaurant\/main-branch\/join$/);
    expect(join.startsWith("http")).toBe(true);

    const status = getPublicQueueStatusUrl({
      restaurantSlug: "demo-restaurant",
      branchSlug: "main-branch",
      accessToken: "a".repeat(43),
    });
    expect(status).toContain("/status/");
    expect(status).not.toMatch(/\s/);

    const display = getPublicDisplayUrl({ publicToken: "b".repeat(43) });
    expect(display).toContain("/display/");

    const qr = getPublicQRCodeUrl({ publicToken: "c".repeat(43) });
    expect(qr).toContain("/qr/");
    expect(qr).not.toContain("undefined");
  });

  it("keeps QR routes public and unauthenticated", () => {
    const path = publicQRCodePath("a".repeat(43));
    expect(isProtectedPath(path)).toBe(false);
    expect(isPublicAuthAssetPath(path)).toBe(true);
    expect(isPublicAuthAssetPath("/api/public/qr/token")).toBe(true);
    expect(isPublicQRPath(path)).toBe(true);
  });

  it("validates secure public tokens", () => {
    expect(isValidPublicQRToken("a".repeat(43))).toBe(true);
    expect(isValidPublicQRToken("short")).toBe(false);
    expect(isValidPublicQRToken("x".repeat(80))).toBe(false);
    expect(isValidPublicQRToken("bad token with spaces!!!!")).toBe(false);
  });
});

describe("public QR DTO privacy", () => {
  it("maps an active QR without private fields", () => {
    const mapped = toPublicQRData({
      unavailable: false,
      type: "QUEUE_JOIN",
      qr: { name: "Main Entrance" },
      restaurant: { name: "Demo Restaurant", slug: "demo-restaurant" },
      branch: { name: "Main Branch", slug: "main-branch" },
      queue: { name: "Main Queue" },
      join_path: "/queue/demo-restaurant/main-branch/join",
    });

    expect(mapped.unavailable).toBe(false);
    if (mapped.unavailable) return;
    expect(mapped.joinPath).toBe("/queue/demo-restaurant/main-branch/join");
    expect(mapped.qr.name).toBe("Main Entrance");

    const keys = [...collectKeys(mapped)].map((key) =>
      key.toLowerCase().replace(/[_-]/g, ""),
    );
    for (const sensitive of PUBLIC_QR_SENSITIVE_KEYS) {
      expect(keys).not.toContain(sensitive.replace(/[_-]/g, ""));
    }
    expect(JSON.stringify(mapped)).not.toMatch(
      /phone|email|membership|audit|staff/i,
    );
  });

  it("maps inactive QR to a safe unavailable message", () => {
    const mapped = toPublicQRData({
      unavailable: true,
      reason: "inactive",
    });
    expect(mapped).toMatchObject({
      unavailable: true,
      reason: "inactive",
      message: PUBLIC_QR_MESSAGES.inactive,
    });
  });

  it("rejects malformed RPC payloads", () => {
    expect(
      parsePublicQRRpc({
        unavailable: false,
        type: "QUEUE_JOIN",
        restaurant: { name: "X" },
      }),
    ).toBeNull();
  });

  it("rebuilds join path when RPC path is unexpected", () => {
    const mapped = toPublicQRData({
      unavailable: false,
      type: "QUEUE_JOIN",
      qr: { name: "Door" },
      restaurant: { name: "Demo", slug: "demo" },
      branch: { name: "Main", slug: "main" },
      queue: { name: "Q" },
      join_path: "https://evil.example/phish",
    });
    expect(mapped.unavailable).toBe(false);
    if (mapped.unavailable) return;
    expect(mapped.joinPath).toBe("/queue/demo/main/join");
  });
});

describe("QR generation", () => {
  it("encodes the destination URL in SVG and PNG output", async () => {
    const url = getPublicQRCodeUrl({ publicToken: "d".repeat(43) });
    const svg = await generateQRCodeSvg(url);
    expect(svg).toContain("<svg");
    expect(svg.length).toBeGreaterThan(100);

    const png = await generateQRCodePngDataUrl(url);
    expect(png.startsWith("data:image/png")).toBe(true);
  });

  it("sanitizes download filenames without tokens or UUIDs", () => {
    expect(sanitizeQRFilename("Main Entrance!!", "svg")).toBe(
      "main-entrance-queue-qr.svg",
    );
    expect(sanitizeQRFilename("  ", "png")).toBe("queue-qr.png");
    expect(sanitizeQRFilename("token-abcXYZ", "svg")).not.toMatch(
      /public.?token/i,
    );
  });
});

describe("QR schema migration", () => {
  it("creates qr_codes with secure token + RLS + public resolver", () => {
    const sql = readMigration("qr_codes");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.qr_codes");
    expect(sql).toContain("public_token");
    expect(sql).toContain("generate_qr_public_token");
    expect(sql).toContain("get_public_qr_code");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_public_qr_code",
    );
    expect(sql).toContain("QUEUE_JOIN");
    expect(sql).toContain("gen_random_bytes(32)");
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/customer_id|phone|email/i);
    expect(sql).toContain("join_path");
  });
});
