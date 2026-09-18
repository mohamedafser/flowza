"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import {
  LOGIN_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  authCallbackUrl,
} from "@/lib/auth/paths";
import {
  ensureProfile,
  isEmailVerified,
  resolvePostAuthDestination,
} from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/auth";

export type AuthActionResult = {
  ok: boolean;
  message?: string;
  code?: "UNVERIFIED" | "VALIDATION" | "AUTH";
  hasSession?: boolean;
  redirectTo?: string;
};

function notConfigured(): AuthActionResult {
  return {
    ok: false,
    code: "AUTH",
    message: "Authentication is not configured. Add Supabase env vars first.",
  };
}

export async function signUpAction(input: unknown): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return notConfigured();
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
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: authCallbackUrl(VERIFY_EMAIL_PATH),
    },
  });

  if (error) {
    return {
      ok: false,
      code: "AUTH",
      message: getAuthErrorMessage(error),
    };
  }

  if (data.user) {
    await ensureProfile(data.user);
  }

  // Supabase may return a user with empty identities when email already exists
  // and confirmations are enabled (anti-enumeration). Treat as generic success.
  revalidatePath("/", "layout");
  return { ok: true, hasSession: Boolean(data.session) };
}

export async function signInAction(input: unknown): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = getAuthErrorMessage(error);
    if (/verify your email|email not confirmed/i.test(error.message)) {
      return { ok: false, code: "UNVERIFIED", message };
    }
    return { ok: false, code: "AUTH", message };
  }

  if (data.user) {
    await ensureProfile(data.user);
    if (!isEmailVerified(data.user)) {
      return {
        ok: false,
        code: "UNVERIFIED",
        message: "Please verify your email before signing in.",
      };
    }

    const redirectTo = await resolvePostAuthDestination(data.user);
    revalidatePath("/", "layout");
    return { ok: true, redirectTo };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect(LOGIN_PATH);
}

export async function forgotPasswordAction(
  input: unknown,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  // Always return a generic success message (anti-enumeration).
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authCallbackUrl(RESET_PASSWORD_PATH),
  });

  return {
    ok: true,
    message:
      "If an account exists for this email, you'll receive a password reset link.",
  };
}

export async function resetPasswordAction(
  input: unknown,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: "AUTH",
      message: "Your reset session has expired. Request a new link.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      code: "AUTH",
      message: getAuthErrorMessage(error),
    };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  };
}

export async function resendVerificationAction(): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return notConfigured();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      ok: false,
      code: "AUTH",
      message: "Sign in again to resend the verification email.",
    };
  }

  if (isEmailVerified(user)) {
    return { ok: true, message: "Your email is already verified." };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: {
      emailRedirectTo: authCallbackUrl(VERIFY_EMAIL_PATH),
    },
  });

  if (error) {
    return {
      ok: false,
      code: "AUTH",
      message: getAuthErrorMessage(error),
    };
  }

  return {
    ok: true,
    message: "Verification email sent. Check your inbox.",
  };
}
