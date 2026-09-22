import { describe, expect, it } from "vitest";
import {
  generateOtpCode,
  hashOtp,
  hashToken,
  secureEquals,
} from "@/lib/auth/otp/crypto";
import { otpCodeSchema, verifyOtpSchema } from "@/lib/validations/auth";
import { getOtpConfig } from "@/lib/auth/otp/config";

describe("OTP crypto", () => {
  it("generates exactly 6 digit codes", () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("hashes OTPs differently for different purposes/emails", () => {
    const a = hashOtp("123456", "a@example.com", "SIGNUP");
    const b = hashOtp("123456", "b@example.com", "SIGNUP");
    const c = hashOtp("123456", "a@example.com", "PASSWORD_RESET");
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(64);
  });

  it("compares hashes in constant time", () => {
    const hash = hashOtp("654321", "user@example.com", "SIGNUP");
    expect(secureEquals(hash, hash)).toBe(true);
    expect(secureEquals(hash, hashToken("other"))).toBe(false);
  });
});

describe("OTP validation", () => {
  it("accepts a 6-digit code", () => {
    expect(otpCodeSchema.safeParse("012345").success).toBe(true);
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
    expect(otpCodeSchema.safeParse("abcdef").success).toBe(false);
  });

  it("validates verify payload", () => {
    expect(
      verifyOtpSchema.safeParse({
        email: "user@example.com",
        code: "123456",
        purpose: "SIGNUP",
      }).success,
    ).toBe(true);
  });
});

describe("OTP config defaults", () => {
  it("defaults to 5 minute expiry and 5 attempts", () => {
    const config = getOtpConfig();
    expect(config.expiryMinutes).toBe(5);
    expect(config.maxAttempts).toBe(5);
    expect(config.resendCooldownSeconds).toBe(60);
  });
});
