import { describe, expect, it } from "vitest";
import {
  isAuthPagePath,
  isProtectedPath,
  safeRedirectPath,
} from "@/lib/auth/paths";
import { getAuthErrorMessage } from "@/lib/auth/errors";

describe("auth route helpers", () => {
  it("marks dashboard, settings, and onboarding as protected", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/overview")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/restaurant")).toBe(true);
    expect(isProtectedPath("/onboarding/restaurant")).toBe(true);
    expect(isProtectedPath("/dashboard/tables")).toBe(true);
    expect(isProtectedPath("/settings/tables")).toBe(true);
    expect(isProtectedPath("/dashboard/customers")).toBe(true);
    expect(isProtectedPath("/dashboard/customers/new")).toBe(true);
    expect(isProtectedPath("/dashboard/queue")).toBe(true);
    expect(isProtectedPath("/dashboard/displays")).toBe(true);
    expect(isProtectedPath("/queue/demo-restaurant/demo-branch")).toBe(false);
    expect(isProtectedPath("/display/token")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("recognizes auth pages", () => {
    expect(isAuthPagePath("/login")).toBe(true);
    expect(isAuthPagePath("/signup")).toBe(true);
    expect(isAuthPagePath("/forgot-password")).toBe(true);
    expect(isAuthPagePath("/reset-password")).toBe(true);
    expect(isAuthPagePath("/verify-email")).toBe(true);
    expect(isAuthPagePath("/verify-reset-otp")).toBe(true);
    expect(isAuthPagePath("/dashboard")).toBe(false);
  });

  it("sanitizes redirect targets", () => {
    expect(safeRedirectPath("/dashboard/queue")).toBe("/dashboard/queue");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard/overview");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard/overview");
    expect(safeRedirectPath(null)).toBe("/dashboard/overview");
  });
});

describe("auth error mapping", () => {
  it("maps common supabase errors to safe messages", () => {
    expect(getAuthErrorMessage("Invalid login credentials")).toBe(
      "Invalid email or password.",
    );
    expect(getAuthErrorMessage("Email not confirmed")).toMatch(/verify/i);
    expect(getAuthErrorMessage("User already registered")).toMatch(/already/i);
  });

  it("falls back without leaking internals", () => {
    expect(getAuthErrorMessage("relation does not exist")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
