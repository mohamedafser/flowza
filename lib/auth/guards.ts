import { redirect } from "next/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { hasPermission } from "@/lib/auth/permissions";
import {
  DASHBOARD_OVERVIEW_PATH,
  LOGIN_PATH,
  VERIFY_EMAIL_PATH,
} from "@/lib/auth/paths";
import type { MemberRole } from "@/lib/auth/roles";
import {
  getAuthContext,
  getMembershipForRestaurant,
  isEmailVerified,
  type AuthContext,
  type MembershipWithRestaurant,
} from "@/lib/auth/session";

export class AuthorizationError extends Error {
  readonly code:
    "UNAUTHENTICATED" | "UNVERIFIED" | "FORBIDDEN" | "NO_MEMBERSHIP";

  constructor(
    code: AuthorizationError["code"],
    message = "You are not authorized to perform this action.",
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new AuthorizationError("UNAUTHENTICATED", "Sign in to continue.");
  }
  return context;
}

export async function requireVerifiedAuth(): Promise<AuthContext> {
  const context = await requireAuth();
  if (!isEmailVerified(context.user)) {
    throw new AuthorizationError(
      "UNVERIFIED",
      "Verify your email to continue.",
    );
  }
  return context;
}

export async function requireRestaurantMembership(
  restaurantId: string,
): Promise<
  AuthContext & { membership: MembershipWithRestaurant; role: MemberRole }
> {
  const context = await requireVerifiedAuth();
  const membership = await getMembershipForRestaurant(
    context.user.id,
    restaurantId,
  );

  if (!membership) {
    throw new AuthorizationError(
      "NO_MEMBERSHIP",
      "You do not belong to this restaurant.",
    );
  }

  return {
    ...context,
    membership,
    restaurant: membership.restaurant,
    role: membership.role,
  };
}

export async function requirePermission(
  restaurantId: string,
  permission: Permission,
): Promise<
  AuthContext & { membership: MembershipWithRestaurant; role: MemberRole }
> {
  const context = await requireRestaurantMembership(restaurantId);

  if (!hasPermission(context.role, permission)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
    );
  }

  return context;
}

/** Redirect helpers for Server Components / layouts. */
export async function requireVerifiedPage(): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    redirect(LOGIN_PATH);
  }

  if (!isEmailVerified(context.user)) {
    redirect(VERIFY_EMAIL_PATH);
  }

  return context;
}

export async function redirectIfAuthenticated(
  destination = DASHBOARD_OVERVIEW_PATH,
): Promise<void> {
  const context = await getAuthContext();
  if (!context) {
    return;
  }

  if (!isEmailVerified(context.user)) {
    redirect(VERIFY_EMAIL_PATH);
  }

  redirect(destination);
}
