import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuthAdminUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown>;
};

/**
 * Look up an auth user by email via the Admin API.
 * Never expose whether the user exists to untrusted clients without care.
 */
export async function findAuthUserByEmail(
  email: string,
): Promise<AuthAdminUser | null> {
  if (!isServiceRoleConfigured()) {
    return null;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return null;
  }

  const { url } = getSupabaseEnv();
  const normalized = email.trim().toLowerCase();

  try {
    const response = await fetch(
      `${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const json: unknown = await response.json();
    const users =
      json &&
      typeof json === "object" &&
      "users" in json &&
      Array.isArray((json as { users: unknown }).users)
        ? (json as { users: AuthAdminUser[] }).users
        : Array.isArray(json)
          ? (json as AuthAdminUser[])
          : [];

    const match = users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    return match ?? null;
  } catch {
    return null;
  }
}

export async function markEmailVerified(userId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return false;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  return !error;
}

/**
 * Establish a cookie session for an email after OTP verification when the
 * browser has no session yet (e.g. login blocked until email confirmed).
 */
export async function createSessionForVerifiedEmail(
  email: string,
): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
  });

  if (error || !data?.properties?.hashed_token) {
    return false;
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });

  return !verifyError;
}

export async function updateUserPassword(
  userId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Password reset is not configured." };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return {
      ok: false,
      message: "Unable to update password. Please try again.",
    };
  }

  return { ok: true };
}

export async function createUnconfirmedUser(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<
  | { ok: true; userId: string }
  | { ok: false; code: "EXISTS" | "UNKNOWN"; message: string }
> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Authentication is not configured.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: false,
    user_metadata: { full_name: input.fullName },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return {
        ok: false,
        code: "EXISTS",
        message: "An account with this email already exists.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create account. Please try again.",
    };
  }

  if (!data.user) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create account. Please try again.",
    };
  }

  return { ok: true, userId: data.user.id };
}
