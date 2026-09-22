import { revalidatePath } from "next/cache";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import {
  LOGIN_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  VERIFY_RESET_OTP_PATH,
} from "@/lib/auth/paths";
import {
  ensureProfile,
  isEmailVerified,
  resolvePostAuthDestination,
} from "@/lib/auth/session";
import { isAuthEmailConfigured } from "@/lib/auth/otp/config";
import type { ActionErrorCode } from "@/lib/errors/action";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from "@/lib/validations/auth";
import {
  createSessionForVerifiedEmail,
  createUnconfirmedUser,
  findAuthUserByEmail,
  markEmailVerified,
  updateUserPassword,
} from "@/services/auth/admin-users";
import { issueOtp, verifyOtpCode } from "@/services/auth/otp";
import {
  clearPasswordResetCookie,
  consumePasswordResetAuthorization,
  createPasswordResetAuthorization,
  setPasswordResetCookie,
} from "@/services/auth/password-reset";
import {
  sendEmailVerificationSuccessEmail,
  sendPasswordResetSuccessEmail,
} from "@/services/auth/email";

export type AuthFlowData = {
  redirectTo?: string;
  email?: string;
  expiresAt?: string;
  resendAvailableAt?: string;
  retryAfterSeconds?: number;
  hasSession?: boolean;
};

export type AuthFlowResult =
  | { ok: true; message?: string; data: AuthFlowData }
  | {
      ok: false;
      code: ActionErrorCode;
      message: string;
      data?: AuthFlowData;
    };

function notConfigured(): AuthFlowResult {
  return {
    ok: false,
    code: "UNKNOWN",
    message: "Authentication is not configured. Add Supabase env vars first.",
  };
}

function otpInfraMissing(): AuthFlowResult {
  return {
    ok: false,
    code: "UNKNOWN",
    message:
      "OTP email delivery is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SMTP_* (or RESEND_*) on the server.",
  };
}

function mapOtpFailCode(code: string): ActionErrorCode {
  if (code === "COOLDOWN") return "RATE_LIMITED";
  if (
    code === "EXPIRED" ||
    code === "LOCKED" ||
    code === "INVALID" ||
    code === "VALIDATION"
  ) {
    return "VALIDATION";
  }
  if (code === "NOT_FOUND") return "NOT_FOUND";
  return "UNKNOWN";
}

export async function signUp(input: unknown): Promise<AuthFlowResult> {
  if (!isSupabaseConfigured()) return notConfigured();
  if (!isServiceRoleConfigured() || !isAuthEmailConfigured()) {
    return otpInfraMissing();
  }

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { fullName, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const created = await createUnconfirmedUser({
    email: normalizedEmail,
    password,
    fullName,
  });

  if (!created.ok && created.code === "EXISTS") {
    // Invite / retry path: account may already exist from a prior incomplete signup.
    return continueSignupForExistingAccount({
      email: normalizedEmail,
      password,
      fullName,
    });
  }

  if (!created.ok) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: created.message,
    };
  }

  return finishSignupWithOtp({
    email: normalizedEmail,
    password,
    fullName,
    userId: created.userId,
  });
}

async function continueSignupForExistingAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthFlowResult> {
  const existing = await findAuthUserByEmail(input.email);
  if (!existing) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "An account with this email already exists. Please log in.",
      data: { redirectTo: LOGIN_PATH, email: input.email },
    };
  }

  if (existing.email_confirmed_at) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "An account with this email already exists. Please log in.",
      data: { redirectTo: LOGIN_PATH, email: input.email },
    };
  }

  const supabase = await createClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

  if (signInError) {
    if (/verify your email|email not confirmed/i.test(signInError.message)) {
      // Password is correct; continue verification.
      const otp = await issueOtp({
        email: input.email,
        purpose: "SIGNUP",
        userId: existing.id,
        fullName: input.fullName,
      });
      if (!otp.ok) {
        return {
          ok: false,
          code: mapOtpFailCode(otp.code),
          message: otp.message,
          data: {
            retryAfterSeconds: otp.retryAfterSeconds,
            redirectTo: `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(input.email)}`,
            email: input.email,
          },
        };
      }
      return {
        ok: true,
        message: "Check your email for a verification code to finish signup.",
        data: {
          redirectTo: `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(input.email)}`,
          email: input.email,
          expiresAt: otp.expiresAt,
          resendAvailableAt: otp.resendAvailableAt,
        },
      };
    }

    return {
      ok: false,
      code: "CONFLICT",
      message:
        "An account with this email already exists. Log in with your password, or use Forgot password.",
      data: { redirectTo: LOGIN_PATH, email: input.email },
    };
  }

  if (signInData.user) {
    await ensureProfile(signInData.user);
    return finishSignupWithOtp({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      userId: signInData.user.id,
      alreadySignedIn: true,
    });
  }

  return {
    ok: false,
    code: "UNKNOWN",
    message: "Unable to continue signup. Please try logging in.",
  };
}

async function finishSignupWithOtp(input: {
  email: string;
  password: string;
  fullName: string;
  userId: string;
  alreadySignedIn?: boolean;
}): Promise<AuthFlowResult> {
  const supabase = await createClient();

  if (!input.alreadySignedIn) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

    if (signInError || !signInData.user) {
      const otp = await issueOtp({
        email: input.email,
        purpose: "SIGNUP",
        userId: input.userId,
        fullName: input.fullName,
      });
      return {
        ok: true,
        message: "Account created. Enter the code we emailed you.",
        data: {
          redirectTo: `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(input.email)}`,
          email: input.email,
          expiresAt: otp.ok ? otp.expiresAt : undefined,
          resendAvailableAt: otp.ok ? otp.resendAvailableAt : undefined,
        },
      };
    }

    await ensureProfile(signInData.user);
  }

  const otp = await issueOtp({
    email: input.email,
    purpose: "SIGNUP",
    userId: input.userId,
    fullName: input.fullName,
  });

  if (!otp.ok) {
    return {
      ok: false,
      code: mapOtpFailCode(otp.code),
      message: otp.message,
      data: {
        retryAfterSeconds: otp.retryAfterSeconds,
        redirectTo: VERIFY_EMAIL_PATH,
        email: input.email,
      },
    };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Account created. Enter the code we emailed you.",
    data: {
      hasSession: true,
      redirectTo: VERIFY_EMAIL_PATH,
      email: input.email,
      expiresAt: otp.expiresAt,
      resendAvailableAt: otp.resendAvailableAt,
    },
  };
}

export async function signIn(input: unknown): Promise<AuthFlowResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    const message = getAuthErrorMessage(error);
    if (/verify your email|email not confirmed/i.test(error.message)) {
      const user = await findAuthUserByEmail(normalizedEmail);
      if (isServiceRoleConfigured() && isAuthEmailConfigured()) {
        await issueOtp({
          email: normalizedEmail,
          purpose: "SIGNUP",
          userId: user?.id,
        });
      }
      return {
        ok: false,
        code: "UNVERIFIED",
        message,
        data: {
          redirectTo: `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(normalizedEmail)}`,
          email: normalizedEmail,
        },
      };
    }
    return { ok: false, code: "UNKNOWN", message };
  }

  if (data.user) {
    await ensureProfile(data.user);
    if (!isEmailVerified(data.user)) {
      const userEmail = (data.user.email ?? normalizedEmail)
        .trim()
        .toLowerCase();
      if (isServiceRoleConfigured() && isAuthEmailConfigured()) {
        await issueOtp({
          email: userEmail,
          purpose: "SIGNUP",
          userId: data.user.id,
        });
      }
      return {
        ok: false,
        code: "UNVERIFIED",
        message: "Please verify your email before signing in.",
        data: {
          redirectTo: VERIFY_EMAIL_PATH,
          email: userEmail,
          hasSession: true,
        },
      };
    }

    const redirectTo = await resolvePostAuthDestination(data.user);
    revalidatePath("/", "layout");
    return { ok: true, data: { redirectTo, hasSession: true } };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: {} };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  await clearPasswordResetCookie();
  revalidatePath("/", "layout");
}

export async function forgotPassword(input: unknown): Promise<AuthFlowResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const redirectTo = `${VERIFY_RESET_OTP_PATH}?email=${encodeURIComponent(email)}`;

  if (!isServiceRoleConfigured() || !isAuthEmailConfigured()) {
    return {
      ok: true,
      message:
        "If an account exists for this email, you'll receive a verification code.",
      data: { email, redirectTo },
    };
  }

  const user = await findAuthUserByEmail(email);
  if (!user) {
    return {
      ok: true,
      message:
        "If an account exists for this email, you'll receive a verification code.",
      data: { email, redirectTo },
    };
  }

  const otp = await issueOtp({
    email,
    purpose: "PASSWORD_RESET",
    userId: user.id,
  });

  if (!otp.ok && otp.code === "COOLDOWN") {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: otp.message,
      data: {
        email,
        redirectTo,
        retryAfterSeconds: otp.retryAfterSeconds,
      },
    };
  }

  const params = new URLSearchParams({ email });
  if (otp.ok) {
    params.set("expiresAt", otp.expiresAt);
    params.set("resendAvailableAt", otp.resendAvailableAt);
  }

  return {
    ok: true,
    message:
      "If an account exists for this email, you'll receive a verification code.",
    data: {
      email,
      redirectTo: `${VERIFY_RESET_OTP_PATH}?${params.toString()}`,
      expiresAt: otp.ok ? otp.expiresAt : undefined,
      resendAvailableAt: otp.ok ? otp.resendAvailableAt : undefined,
    },
  };
}

export async function verifyOtp(input: unknown): Promise<AuthFlowResult> {
  if (!isSupabaseConfigured()) return notConfigured();
  if (!isServiceRoleConfigured()) return otpInfraMissing();

  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const purpose = parsed.data.purpose;

  const verified = await verifyOtpCode({
    email,
    purpose,
    code: parsed.data.code,
  });

  if (!verified.ok) {
    return {
      ok: false,
      code: mapOtpFailCode(verified.code),
      message: verified.message,
    };
  }

  if (purpose === "PASSWORD_RESET") {
    const user =
      (verified.userId
        ? { id: verified.userId, email }
        : await findAuthUserByEmail(email)) ?? null;

    if (!user) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: "Unable to authorize password reset. Please try again.",
      };
    }

    const authz = await createPasswordResetAuthorization({
      userId: user.id,
      email,
    });
    if (!authz.ok) {
      return { ok: false, code: "UNKNOWN", message: authz.message };
    }

    await setPasswordResetCookie(authz.token);
    return {
      ok: true,
      message: "Code verified. Choose a new password.",
      data: { redirectTo: RESET_PASSWORD_PATH, email },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId = user?.id ?? verified.userId;
  if (!userId) {
    const adminUser = await findAuthUserByEmail(email);
    userId = adminUser?.id ?? null;
  }

  if (!userId) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to verify email. Request a new code and try again.",
    };
  }

  if (user?.email && user.email.trim().toLowerCase() !== email) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "This code does not match the signed-in email address.",
    };
  }

  const confirmed = await markEmailVerified(userId);
  if (!confirmed) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to verify email. Please try again.",
    };
  }

  // Ensure a browser session exists (invite/login paths may have none yet).
  let {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (!sessionUser) {
    const established = await createSessionForVerifiedEmail(email);
    if (!established) {
      return {
        ok: false,
        code: "UNKNOWN",
        message:
          "Email verified, but we could not start your session. Please log in.",
        data: { redirectTo: LOGIN_PATH, email },
      };
    }
    ({
      data: { user: sessionUser },
    } = await supabase.auth.getUser());
  } else {
    await supabase.auth.refreshSession();
    ({
      data: { user: sessionUser },
    } = await supabase.auth.getUser());
  }

  const redirectTo = sessionUser
    ? await resolvePostAuthDestination(sessionUser)
    : LOGIN_PATH;

  // Best-effort confirmation email — verification already succeeded.
  void sendEmailVerificationSuccessEmail({ to: email }).catch(() => undefined);

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Email verified.",
    data: {
      redirectTo,
      email,
      hasSession: Boolean(sessionUser),
    },
  };
}

export async function resendOtp(input: unknown = {}): Promise<AuthFlowResult> {
  if (!isSupabaseConfigured()) return notConfigured();
  if (!isServiceRoleConfigured() || !isAuthEmailConfigured()) {
    return otpInfraMissing();
  }

  const parsed = resendOtpSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const purpose = parsed.data.purpose;
  let email = parsed.data.email?.trim().toLowerCase();
  let userId: string | null = null;
  let fullName: string | null = null;

  if (purpose === "SIGNUP" || purpose === "INVITATION") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      email = user.email.trim().toLowerCase();
      userId = user.id;
      const metaName = user.user_metadata?.full_name;
      fullName = typeof metaName === "string" ? metaName : null;
    } else if (email) {
      const adminUser = await findAuthUserByEmail(email);
      userId = adminUser?.id ?? null;
    }
  }

  if (!email) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Email is required to resend a code.",
    };
  }

  if (purpose === "PASSWORD_RESET" && !userId) {
    const user = await findAuthUserByEmail(email);
    if (!user) {
      return {
        ok: true,
        message: "If an account exists for this email, you'll receive a code.",
        data: { email },
      };
    }
    userId = user.id;
  }

  const otp = await issueOtp({
    email,
    purpose: purpose === "INVITATION" ? "SIGNUP" : purpose,
    userId,
    fullName,
  });

  if (!otp.ok) {
    return {
      ok: false,
      code: mapOtpFailCode(otp.code),
      message: otp.message,
      data: { retryAfterSeconds: otp.retryAfterSeconds, email },
    };
  }

  return {
    ok: true,
    message: "Verification code sent. Check your inbox.",
    data: {
      email,
      expiresAt: otp.expiresAt,
      resendAvailableAt: otp.resendAvailableAt,
    },
  };
}

export async function resetPassword(input: unknown): Promise<AuthFlowResult> {
  if (!isSupabaseConfigured()) return notConfigured();

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const authz = await consumePasswordResetAuthorization();
  if (!authz.ok) {
    return { ok: false, code: "UNAUTHENTICATED", message: authz.message };
  }

  const updated = await updateUserPassword(authz.userId, parsed.data.password);
  if (!updated.ok) {
    return { ok: false, code: "UNKNOWN", message: updated.message };
  }

  // Best-effort security notice — password update already succeeded.
  void sendPasswordResetSuccessEmail({ to: authz.email }).catch(() => undefined);

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Password updated. You can sign in with your new password.",
    data: { redirectTo: LOGIN_PATH },
  };
}
