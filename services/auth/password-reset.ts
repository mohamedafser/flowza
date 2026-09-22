import { cookies } from "next/headers";
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import {
  generateSecureToken,
  hashToken,
  secureEquals,
} from "@/lib/auth/otp/crypto";

export const PASSWORD_RESET_COOKIE = "flowza_password_reset";

const RESET_AUTH_TTL_MS = 10 * 60 * 1000;

type ResetCookiePayload = {
  aid: string;
  email: string;
};

export async function createPasswordResetAuthorization(input: {
  userId: string;
  email: string;
}): Promise<
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; message: string }
> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, message: "Password reset is not configured." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Password reset is not configured." };
  }

  const email = input.email.trim().toLowerCase();
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_AUTH_TTL_MS).toISOString();

  // Invalidate prior unused authorizations for this user.
  await admin
    .from("password_reset_authorizations")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .is("used_at", null);

  const { data, error } = await admin
    .from("password_reset_authorizations")
    .insert({
      user_id: input.userId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "Unable to authorize password reset." };
  }

  return { ok: true, token: `${data.id}.${token}`, expiresAt };
}

export async function setPasswordResetCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(PASSWORD_RESET_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(RESET_AUTH_TTL_MS / 1000),
  });
}

export async function clearPasswordResetCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PASSWORD_RESET_COOKIE);
}

export async function consumePasswordResetAuthorization(): Promise<
  { ok: true; userId: string; email: string } | { ok: false; message: string }
> {
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  const jar = await cookies();
  const raw = jar.get(PASSWORD_RESET_COOKIE)?.value;
  if (!raw) {
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  const [authorizationId, token] = raw.split(".", 2);
  if (!authorizationId || !token) {
    await clearPasswordResetCookie();
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  const { data, error } = await admin
    .from("password_reset_authorizations")
    .select("id, user_id, email, token_hash, expires_at, used_at")
    .eq("id", authorizationId)
    .maybeSingle();

  if (error || !data) {
    await clearPasswordResetCookie();
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  if (data.used_at || Date.parse(data.expires_at) <= Date.now()) {
    await clearPasswordResetCookie();
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  if (!secureEquals(data.token_hash, hashToken(token))) {
    await clearPasswordResetCookie();
    return {
      ok: false,
      message: "Your reset session has expired. Request a new code.",
    };
  }

  const { error: useError } = await admin
    .from("password_reset_authorizations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("used_at", null);

  if (useError) {
    return {
      ok: false,
      message: "Unable to complete password reset. Please try again.",
    };
  }

  await clearPasswordResetCookie();

  return {
    ok: true,
    userId: data.user_id,
    email: data.email,
  };
}

export type { ResetCookiePayload };
