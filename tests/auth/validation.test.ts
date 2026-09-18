import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/auth";

describe("auth validation", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({
      email: "owner@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid login email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty login password", () => {
    const result = loginSchema.safeParse({
      email: "owner@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid signup payload", () => {
    const result = signupSchema.safeParse({
      fullName: "Alex Rivera",
      email: "alex@example.com",
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects weak signup passwords", () => {
    const result = signupSchema.safeParse({
      fullName: "Alex Rivera",
      email: "alex@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password confirmation mismatch", () => {
    const result = signupSchema.safeParse({
      fullName: "Alex Rivera",
      email: "alex@example.com",
      password: "Password1",
      confirmPassword: "Password2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes("confirmPassword"),
        ),
      ).toBe(true);
    }
  });

  it("accepts forgot-password email", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "alex@example.com" }).success,
    ).toBe(true);
  });

  it("validates reset password confirmation", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "Password1",
        confirmPassword: "Password1",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        password: "Password1",
        confirmPassword: "Password2",
      }).success,
    ).toBe(false);
  });
});
