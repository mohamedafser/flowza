import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { getOtpConfig } from "@/lib/auth/otp/config";
import { generateOtpCode, hashOtp, secureEquals } from "@/lib/auth/otp/crypto";
import {
  sendPasswordResetOtpEmail,
  sendSignupOtpEmail,
} from "@/services/auth/email";

export type OtpPurpose = "SIGNUP" | "PASSWORD_RESET" | "INVITATION";

export type OtpMutationResult =
  | {
      ok: true;
      expiresAt: string;
      resendAvailableAt: string;
    }
  | {
      ok: false;
      code:
        | "NOT_CONFIGURED"
        | "COOLDOWN"
        | "VALIDATION"
        | "NOT_FOUND"
        | "EXPIRED"
        | "LOCKED"
        | "INVALID"
        | "UNKNOWN";
      message: string;
      retryAfterSeconds?: number;
    };

type AuthOtpRow = {
  id: string;
  user_id: string | null;
  email: string;
  purpose: OtpPurpose;
  otp_hash: string;
  expires_at: string;
  verified_at: string | null;
  attempt_count: number;
  last_sent_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireAdmin() {
  if (!isServiceRoleConfigured()) {
    return null;
  }
  return createServiceRoleClient();
}

function resendAvailableAt(lastSentAt: string, cooldownSeconds: number): Date {
  return new Date(Date.parse(lastSentAt) + cooldownSeconds * 1000);
}

function cooldownSecondsRemaining(lastSentAt: string, cooldownSeconds: number) {
  const available = resendAvailableAt(lastSentAt, cooldownSeconds).getTime();
  const remaining = Math.ceil((available - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

async function loadActiveOtp(
  email: string,
  purpose: OtpPurpose,
): Promise<AuthOtpRow | null> {
  const admin = requireAdmin();
  if (!admin) return null;

  const { data } = await admin
    .from("auth_otps")
    .select(
      "id, user_id, email, purpose, otp_hash, expires_at, verified_at, attempt_count, last_sent_at",
    )
    .eq("email", email)
    .eq("purpose", purpose)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as AuthOtpRow | null) ?? null;
}

/**
 * Issue a new OTP for email+purpose. Never returns the code to the caller —
 * only sends it by email.
 */
export async function issueOtp(input: {
  email: string;
  purpose: OtpPurpose;
  userId?: string | null;
  fullName?: string | null;
}): Promise<OtpMutationResult> {
  const admin = requireAdmin();
  if (!admin) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Authentication email is not configured on the server.",
    };
  }

  const email = normalizeEmail(input.email);
  const config = getOtpConfig();
  const existing = await loadActiveOtp(email, input.purpose);

  if (existing) {
    const wait = cooldownSecondsRemaining(
      existing.last_sent_at,
      config.resendCooldownSeconds,
    );
    if (wait > 0) {
      return {
        ok: false,
        code: "COOLDOWN",
        message: `Please wait ${wait}s before requesting another code.`,
        retryAfterSeconds: wait,
      };
    }
  }

  const code = generateOtpCode();
  const otpHash = hashOtp(code, email, input.purpose);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.expiryMinutes * 60_000);

  if (existing) {
    const { error } = await admin
      .from("auth_otps")
      .update({
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        attempt_count: 0,
        last_sent_at: now.toISOString(),
        user_id: input.userId ?? existing.user_id,
        verified_at: null,
      })
      .eq("id", existing.id);

    if (error) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: "Unable to send verification code. Please try again.",
      };
    }
  } else {
    const { error } = await admin.from("auth_otps").insert({
      email,
      purpose: input.purpose,
      otp_hash: otpHash,
      expires_at: expiresAt.toISOString(),
      last_sent_at: now.toISOString(),
      user_id: input.userId ?? null,
      attempt_count: 0,
    });

    if (error) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: "Unable to send verification code. Please try again.",
      };
    }
  }

  const emailResult =
    input.purpose === "PASSWORD_RESET"
      ? await sendPasswordResetOtpEmail({
          to: email,
          code,
          expiryMinutes: config.expiryMinutes,
        })
      : await sendSignupOtpEmail({
          to: email,
          fullName: input.fullName,
          code,
          expiryMinutes: config.expiryMinutes,
        });

  if (!emailResult.ok) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: emailResult.message,
    };
  }

  return {
    ok: true,
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: resendAvailableAt(
      now.toISOString(),
      config.resendCooldownSeconds,
    ).toISOString(),
  };
}

export async function verifyOtpCode(input: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<
  | { ok: true; userId: string | null; otpId: string }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "NOT_FOUND"
        | "EXPIRED"
        | "LOCKED"
        | "INVALID"
        | "NOT_CONFIGURED"
        | "UNKNOWN";
      message: string;
    }
> {
  const admin = requireAdmin();
  if (!admin) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Authentication email is not configured on the server.",
    };
  }

  const email = normalizeEmail(input.email);
  const code = input.code.trim();

  if (!/^\d{6}$/.test(code)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Enter the 6-digit verification code.",
    };
  }

  const existing = await loadActiveOtp(email, input.purpose);
  if (!existing) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Request a new verification code and try again.",
    };
  }

  const config = getOtpConfig();
  if (existing.attempt_count >= config.maxAttempts) {
    return {
      ok: false,
      code: "LOCKED",
      message: "Too many incorrect attempts. Please request a new code.",
    };
  }

  if (Date.parse(existing.expires_at) <= Date.now()) {
    return {
      ok: false,
      code: "EXPIRED",
      message: "This verification code has expired. Please request a new code.",
    };
  }

  const expected = hashOtp(code, email, input.purpose);
  if (!secureEquals(existing.otp_hash, expected)) {
    await admin
      .from("auth_otps")
      .update({ attempt_count: existing.attempt_count + 1 })
      .eq("id", existing.id);

    const remaining = config.maxAttempts - existing.attempt_count - 1;
    if (remaining <= 0) {
      return {
        ok: false,
        code: "LOCKED",
        message: "Too many incorrect attempts. Please request a new code.",
      };
    }

    return {
      ok: false,
      code: "INVALID",
      message:
        "The verification code is invalid. Please check the code and try again.",
    };
  }

  const { error } = await admin
    .from("auth_otps")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", existing.id)
    .is("verified_at", null);

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to verify the code. Please try again.",
    };
  }

  return { ok: true, userId: existing.user_id, otpId: existing.id };
}

export async function getOtpStatus(input: {
  email: string;
  purpose: OtpPurpose;
}): Promise<{
  hasActive: boolean;
  expiresAt: string | null;
  resendAvailableAt: string | null;
  locked: boolean;
}> {
  const config = getOtpConfig();
  const existing = await loadActiveOtp(
    normalizeEmail(input.email),
    input.purpose,
  );
  if (!existing) {
    return {
      hasActive: false,
      expiresAt: null,
      resendAvailableAt: null,
      locked: false,
    };
  }

  return {
    hasActive: Date.parse(existing.expires_at) > Date.now(),
    expiresAt: existing.expires_at,
    resendAvailableAt: resendAvailableAt(
      existing.last_sent_at,
      config.resendCooldownSeconds,
    ).toISOString(),
    locked: existing.attempt_count >= config.maxAttempts,
  };
}
