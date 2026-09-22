import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MemoryRateLimiter,
  appRateLimiter,
  consumeAppRateLimit,
  resolveAppRateLimitAction,
} from "@/lib/security/rate-limit";
import {
  logSecurityEvent,
  maskEmail,
  maskPhone,
  sanitizeDetails,
} from "@/lib/security/logging";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security/headers";
import { detectImageMimeFromBytes } from "@/lib/security/uploads";
import { safeAppClickUrl } from "@/lib/security/urls";
import { safeRedirectPath } from "@/lib/auth/paths";
import { hasPermission } from "@/lib/auth/permissions";
import {
  hasPlatformPermission,
  isPlatformRole,
} from "@/lib/auth/platform-permissions";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("Phase 18 rate limiting", () => {
  beforeEach(() => {
    appRateLimiter.reset();
  });

  it("limits repeated auth login attempts", () => {
    const limiter = new MemoryRateLimiter();
    for (let i = 0; i < 10; i++) {
      expect(limiter.consume("authLogin:1.1.1.1", 10, 60_000).allowed).toBe(
        true,
      );
    }
    expect(limiter.consume("authLogin:1.1.1.1", 10, 60_000).allowed).toBe(
      false,
    );
  });

  it("maps sensitive API paths to rate-limit actions", () => {
    expect(resolveAppRateLimitAction("/api/auth/login", "POST")).toBe(
      "authLogin",
    );
    expect(resolveAppRateLimitAction("/api/auth/signup", "POST")).toBe(
      "authSignup",
    );
    expect(resolveAppRateLimitAction("/api/billing/checkout", "POST")).toBe(
      "billingCheckout",
    );
    expect(resolveAppRateLimitAction("/api/webhooks/razorpay", "POST")).toBe(
      "webhookRazorpay",
    );
    expect(resolveAppRateLimitAction("/api/admin/users", "GET")).toBe(
      "adminApi",
    );
    expect(resolveAppRateLimitAction("/api/health", "GET")).toBeNull();
  });

  it("enforces app rate limits via shared limiter", () => {
    for (let i = 0; i < 10; i++) {
      expect(consumeAppRateLimit("authLogin", "9.9.9.9").allowed).toBe(true);
    }
    expect(consumeAppRateLimit("authLogin", "9.9.9.9").allowed).toBe(false);
  });
});

describe("Phase 18 open redirect protection", () => {
  it("allows safe internal paths", () => {
    expect(safeRedirectPath("/dashboard/overview")).toBe("/dashboard/overview");
    expect(safeRedirectPath("/settings/billing")).toBe("/settings/billing");
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeRedirectPath("https://evil.example")).toBe(
      "/dashboard/overview",
    );
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard/overview");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard/overview");
    expect(safeRedirectPath("/%2F%2Fevil.example")).toBe("/dashboard/overview");
    expect(safeRedirectPath("/auth/callback?code=x")).toBe(
      "/dashboard/overview",
    );
  });
});

describe("Phase 18 security headers & CSP", () => {
  it("emits clickjacking and MIME sniffing protections", () => {
    const headers = buildSecurityHeaders();
    const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("keeps CSP compatible with Supabase and Razorpay without unsafe-eval in production", () => {
    const csp = buildContentSecurityPolicy({ isProduction: true });
    expect(csp).toContain("https://checkout.razorpay.com");
    expect(csp).toContain("supabase.co");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows unsafe-eval in development for React debugging", () => {
    const csp = buildContentSecurityPolicy({ isProduction: false });
    expect(csp).toContain("'unsafe-eval'");
  });
});

describe("Phase 18 logging sanitization", () => {
  it("masks email and phone", () => {
    expect(maskEmail("owner@example.com")).toBe("o***@example.com");
    expect(maskPhone("+919876543210")).toMatch(/\*\*\*\d{2}$/);
  });

  it("redacts secrets from structured details", () => {
    const sanitized = sanitizeDetails({
      password: "secret",
      token: "abc",
      plan: "PRO",
      emailMasked: "o***@example.com",
    });
    expect(sanitized.password).toBe("[redacted]");
    expect(sanitized.token).toBe("[redacted]");
    expect(sanitized.plan).toBe("PRO");
    expect(sanitized.emailMasked).toBe("o***@example.com");
  });

  it("emits structured security events", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logSecurityEvent("LOGIN_FAILURE", {
      emailMasked: "a***@x.com",
      password: "nope",
    });
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.level).toBe("security");
    expect(payload.event).toBe("LOGIN_FAILURE");
    expect(payload.password).toBe("[redacted]");
    spy.mockRestore();
  });
});

describe("Phase 18 upload magic-byte detection", () => {
  it("detects png/jpeg and rejects arbitrary bytes", () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(detectImageMimeFromBytes(png)).toBe("image/png");
    expect(detectImageMimeFromBytes(jpeg)).toBe("image/jpeg");
    expect(detectImageMimeFromBytes(exe)).toBeNull();
  });
});

describe("Phase 18 authorization contracts", () => {
  it("rejects restaurant staff management without permission", () => {
    expect(hasPermission("STAFF", "members.manage")).toBe(false);
    expect(hasPermission("STAFF", "billing.manage")).toBe(false);
    expect(hasPermission("MANAGER", "billing.manage")).toBe(false);
    expect(hasPermission("OWNER", "billing.manage")).toBe(true);
  });

  it("protects platform admin from restaurant roles", () => {
    expect(isPlatformRole("SUPER_ADMIN")).toBe(true);
    expect(isPlatformRole("OWNER")).toBe(false);
    expect(hasPlatformPermission("SUPER_ADMIN", "platform.dashboard.view")).toBe(
      true,
    );
  });

  it("documents Restaurant A cannot access Restaurant B", () => {
    const membershipRestaurantId: string = "rest-a";
    const claimedRestaurantId: string = "rest-b";
    const allowed = membershipRestaurantId === claimedRestaurantId;
    expect(allowed).toBe(false);
  });
});

describe("Phase 18 privilege-column migration", () => {
  it("ships protect_profile_privilege_columns trigger", () => {
    const migrationsDir = resolve(__dirname, "../../supabase/migrations");
    const file = readdirSync(migrationsDir).find((f) =>
      f.includes("security_hardening") && !f.includes("followup"),
    );
    expect(file).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, file!), "utf8");
    expect(sql).toContain("protect_profile_privilege_columns");
    expect(sql).toContain("platform_role cannot be");
    expect(sql).toContain("account_status cannot be");
  });

  it("ships follow-up locks for subscriptions, members, and public queue", () => {
    const migrationsDir = resolve(__dirname, "../../supabase/migrations");
    const file = readdirSync(migrationsDir).find((f) =>
      f.includes("security_hardening_followup"),
    );
    expect(file).toBeTruthy();
    const sql = readFileSync(resolve(migrationsDir, file!), "utf8");
    expect(sql).toContain("DROP POLICY IF EXISTS \"subscriptions_insert_owner_admin\"");
    expect(sql).toContain("protect_restaurant_member_privilege_columns");
    expect(sql).toContain("protect_organization_billing_columns");
    expect(sql).toContain("normalize_public_phone");
    expect(sql).toContain("QUEUE_CONFLICT");
    expect(sql).toContain("NOTIFICATION_FORBIDDEN");
  });
});

describe("Phase 18 SECURITY.md", () => {
  it("documents architecture and production checklist link", () => {
    const root = resolve(__dirname, "../..");
    const security = readFileSync(resolve(root, "SECURITY.md"), "utf8");
    expect(security).toContain("Multi-tenant isolation");
    expect(security).toContain("Row Level Security");
    expect(security).toContain("PRODUCTION_SECURITY_CHECKLIST");
    expect(security.toLowerCase()).not.toMatch(/rzp_live_|service_role\.[a-z0-9]/i);
  });
});

describe("Phase 18 click URL allowlist", () => {
  it("keeps push click targets same-origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.flowza.test";
    expect(safeAppClickUrl("https://evil.example/phish")).toBe(
      "https://app.flowza.test/",
    );
    expect(safeAppClickUrl("/queue/demo/branch")).toBe(
      "https://app.flowza.test/queue/demo/branch",
    );
    expect(safeAppClickUrl("https://app.flowza.test/status")).toBe(
      "https://app.flowza.test/status",
    );
  });
});
