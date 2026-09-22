import { describe, expect, it } from "vitest";
import { statusForActionCode } from "@/lib/api/json";

describe("/api/auth contract", () => {
  it("documents login success JSON", () => {
    const success = {
      ok: true as const,
      data: { redirectTo: "/dashboard/overview", hasSession: true },
    };
    expect(JSON.parse(JSON.stringify(success))).toEqual(success);
  });

  it("documents unverified login JSON with redirect data", () => {
    const failure = {
      ok: false as const,
      code: "UNVERIFIED",
      message: "Please verify your email before signing in.",
      data: {
        redirectTo: "/verify-email?email=mohamedafser2203%2B1%40gmail.com",
        email: "mohamedafser2203+1@gmail.com",
      },
    };
    expect(failure.ok).toBe(false);
    expect(failure.data.redirectTo).toContain("/verify-email");
    expect(statusForActionCode("UNVERIFIED")).toBe(403);
  });

  it("documents verify-otp success redirecting into the app", () => {
    const success = {
      ok: true as const,
      data: {
        redirectTo: "/dashboard/overview",
        email: "mohamedafser2203+1@gmail.com",
        hasSession: true,
      },
    };
    expect(success.data.redirectTo).toBe("/dashboard/overview");
  });

  it("maps cooldown to 429", () => {
    expect(statusForActionCode("RATE_LIMITED")).toBe(429);
  });
});
