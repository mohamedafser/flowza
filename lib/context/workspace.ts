import { redirect } from "next/navigation";
import { cache } from "react";
import {
  DASHBOARD_OVERVIEW_PATH,
  ONBOARDING_RESTAURANT_PATH,
} from "@/lib/auth/paths";
import { requireVerifiedPage } from "@/lib/auth/guards";
import {
  buildWorkspace,
  readBranchPreferenceCookie,
  type RestaurantWorkspace,
} from "@/lib/context/restaurant";
import { listActiveBranchesByRestaurantId } from "@/services/branches";

/**
 * Verified user with at least one restaurant membership + resolved branch.
 * Redirects to onboarding when the user has no restaurants yet.
 * Cached per request to avoid duplicate auth/branch queries.
 */
export const requireWorkspacePage = cache(
  async (): Promise<RestaurantWorkspace> => {
    const auth = await requireVerifiedPage();

    if (auth.memberships.length === 0 || !auth.restaurant) {
      redirect(ONBOARDING_RESTAURANT_PATH);
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
