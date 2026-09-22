import { AuthorizationError } from "@/lib/auth/guards";
import {
  hasPlatformPermission,
  isPlatformRole,
  type PlatformPermission,
  type PlatformRole,
} from "@/lib/auth/platform-permissions";
import {
  ADMIN_PATH,
  LOGIN_PATH,
  VERIFY_EMAIL_PATH,
} from "@/lib/auth/paths";
import {
  getAuthContext,
  isEmailVerified,
  type AuthContext,
  type Profile,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { cache } from "react";

export type PlatformAuthContext = AuthContext & {
  profile: Profile;
  platformRole: PlatformRole;
};

export function getPlatformRoleFromProfile(
  profile: Profile | null | undefined,
): PlatformRole | null {
  if (!profile?.platform_role) return null;
  return isPlatformRole(profile.platform_role) ? profile.platform_role : null;
}

export function isActivePlatformAccount(
  profile: Profile | null | undefined,
): boolean {
  return profile?.account_status === "ACTIVE";
}

/**
 * Require an authenticated, verified SUPER_ADMIN.
 * Never trust a role supplied by the client — always load from profiles.
 */
export async function requirePlatformPermission(
  permission: PlatformPermission,
): Promise<PlatformAuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new AuthorizationError("UNAUTHENTICATED", "Sign in to continue.");
  }

  if (!isEmailVerified(context.user)) {
    throw new AuthorizationError(
      "UNVERIFIED",
      "Verify your email to continue.",
    );
  }

  const profile = context.profile;
  if (!profile || !isActivePlatformAccount(profile)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "This account cannot access platform administration.",
    );
  }

  const platformRole = getPlatformRoleFromProfile(profile);
  if (!platformRole || !hasPlatformPermission(platformRole, permission)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to perform this platform action.",
    );
  }

  return {
    ...context,
    profile,
    platformRole,
  };
}

export async function requireSuperAdmin(): Promise<PlatformAuthContext> {
  return requirePlatformPermission("platform.dashboard.view");
}

/** Server Component / layout gate for /admin. */
export const requireAdminPage = cache(
  async (
    permission: PlatformPermission = "platform.dashboard.view",
  ): Promise<PlatformAuthContext> => {
    const context = await getAuthContext();

    if (!context) {
      redirect(LOGIN_PATH);
    }

    if (!isEmailVerified(context.user)) {
      redirect(VERIFY_EMAIL_PATH);
    }

    const profile = context.profile;
    if (
      !profile ||
      !isActivePlatformAccount(profile) ||
      !getPlatformRoleFromProfile(profile) ||
      !hasPlatformPermission(getPlatformRoleFromProfile(profile), permission)
    ) {
      redirect(`${ADMIN_PATH}/unauthorized`);
    }

    return {
      ...context,
      profile,
      platformRole: getPlatformRoleFromProfile(profile)!,
    };
  },
);
