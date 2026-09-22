import { redirect } from "next/navigation";
import { cache } from "react";
import {
  DASHBOARD_OVERVIEW_PATH,
  ONBOARDING_RESTAURANT_PATH,
  SUSPENDED_PATH,
} from "@/lib/auth/paths";
import { requireVerifiedPage } from "@/lib/auth/guards";
import {
  buildWorkspace,
  readBranchPreferenceCookie,
  type RestaurantWorkspace,
} from "@/lib/context/restaurant";
import { listActiveBranchesByRestaurantId } from "@/services/branches";
import { getPlatformSettings } from "@/services/admin/admin-settings.service";
import { getPlatformRoleFromProfile } from "@/lib/auth/platform-guards";
import { MAINTENANCE_PATH } from "@/lib/auth/paths";

/**
 * Verified user with at least one restaurant membership + resolved branch.
 * Redirects to onboarding when the user has no restaurants yet.
 * Cached per request to avoid duplicate auth/branch queries.
 */
export const requireWorkspacePage = cache(
  async (): Promise<RestaurantWorkspace> => {
    const auth = await requireVerifiedPage();

    // Maintenance mode blocks restaurant workspaces (SUPER_ADMIN uses /admin).
    if (!getPlatformRoleFromProfile(auth.profile)) {
      const settings = await getPlatformSettings().catch(() => null);
      if (settings?.maintenance_mode) {
        redirect(MAINTENANCE_PATH);
      }
    }

    if (auth.memberships.length === 0 || !auth.restaurant) {
      redirect(ONBOARDING_RESTAURANT_PATH);
    }

    if (
      auth.restaurant.status === "SUSPENDED" ||
      auth.restaurant.status === "INACTIVE"
    ) {
      redirect(SUSPENDED_PATH);
    }

    // Switcher only needs active branches — filtered in Postgres.
    const branches = await listActiveBranchesByRestaurantId(auth.restaurant.id);
    const preferredBranchId = await readBranchPreferenceCookie();
    return buildWorkspace(auth, branches, preferredBranchId);
  },
);

/**
 * Verified user who must NOT yet have a restaurant (onboarding only).
 */
export async function requireOnboardingPage(): Promise<
  Awaited<ReturnType<typeof requireVerifiedPage>>
> {
  const auth = await requireVerifiedPage();
  if (auth.memberships.length > 0) {
    redirect(DASHBOARD_OVERVIEW_PATH);
  }
  return auth;
}
