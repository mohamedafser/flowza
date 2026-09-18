"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  BRANCH_PREFERENCE_COOKIE,
  DASHBOARD_OVERVIEW_PATH,
  RESTAURANT_PREFERENCE_COOKIE,
  SETTINGS_BRANCHES_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_RESTAURANT_PATH,
} from "@/lib/auth/paths";
import {
  clearBranchPreferenceCookie,
  setBranchPreferenceCookie,
  setRestaurantPreferenceCookie,
} from "@/lib/context/restaurant";
import {
  restaurantOnboardingSchema,
  restaurantUpdateSchema,
  toRestaurantPayload,
} from "@/lib/validations/restaurant";
import { createRestaurant, updateRestaurant } from "@/services/restaurants";
import { removeRestaurantLogo, uploadRestaurantLogo } from "@/services/storage";
import { getBranch } from "@/services/branches";
import { getMembershipForRestaurant } from "@/lib/auth/session";
import type { Restaurant } from "@/lib/auth/session";

export async function createRestaurantAction(
  input: unknown,
): Promise<ActionResult<{ restaurantId: string; redirectTo: string }>> {
  try {
    const auth = await requireVerifiedAuth();
    const parsed = restaurantOnboardingSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid restaurant details.",
      );
    }

    const result = await createRestaurant(
      auth.user.id,
      toRestaurantPayload(parsed.data),
    );
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    await setRestaurantPreferenceCookie(result.restaurant.id);
    await clearBranchPreferenceCookie();

    revalidatePath("/", "layout");
    return actionOk({
      restaurantId: result.restaurant.id,
      redirectTo: DASHBOARD_OVERVIEW_PATH,
    });
  } catch (error) {
    return mapUnknownError(error, "Unable to create restaurant.");
  }
}

export async function updateRestaurantAction(
  input: unknown,
): Promise<ActionResult<{ restaurant: Restaurant }>> {
  try {
    const parsed = restaurantUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid restaurant details.",
      );
    }

    const { restaurantId, ...fields } = parsed.data;
    const result = await updateRestaurant(
      restaurantId,
      toRestaurantPayload(fields),
    );
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath("/", "layout");
    return actionOk({ restaurant: result.restaurant });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update restaurant.");
  }
}

export async function uploadRestaurantLogoAction(
  formData: FormData,
): Promise<ActionResult<{ logoUrl: string }>> {
  try {
    const restaurantId = String(formData.get("restaurantId") ?? "");
    const file = formData.get("file");

    if (!restaurantId || !(file instanceof File)) {
      return actionFail("VALIDATION", "Choose an image file to upload.");
    }

    const result = await uploadRestaurantLogo(restaurantId, file);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath("/", "layout");
    return actionOk({ logoUrl: result.logoUrl });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to upload logo.");
  }
}

export async function removeRestaurantLogoAction(
  restaurantId: string,
): Promise<ActionResult> {
  try {
    const result = await removeRestaurantLogo(restaurantId);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath("/", "layout");
    return actionOk();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to remove logo.");
  }
}

export async function switchRestaurantAction(
  restaurantId: string,
): Promise<ActionResult<{ restaurantId: string }>> {
  try {
    const auth = await requireVerifiedAuth();
    const membership = await getMembershipForRestaurant(
      auth.user.id,
      restaurantId,
    );

    if (!membership) {
      return actionFail(
        "NO_MEMBERSHIP",
        "You do not belong to this restaurant.",
      );
    }

    await setRestaurantPreferenceCookie(restaurantId);
    await clearBranchPreferenceCookie();

    revalidatePath("/", "layout");
    return actionOk({ restaurantId });
  } catch (error) {
    return mapUnknownError(error, "Unable to switch restaurant.");
  }
}

export async function switchBranchAction(
  branchId: string,
): Promise<ActionResult<{ branchId: string }>> {
  try {
    const auth = await requireVerifiedAuth();
    const branch = await getBranch(branchId);

    if (!branch) {
      return actionFail("NOT_FOUND", "Branch not found.");
    }

    if (!branch.is_active) {
      return actionFail(
        "FORBIDDEN",
        "Inactive branches cannot be selected for operations.",
      );
    }

    if (!auth.restaurant || branch.restaurant_id !== auth.restaurant.id) {
      // Prefer cookie restaurant if auth context is stale — verify membership.
      const membership = await getMembershipForRestaurant(
        auth.user.id,
        branch.restaurant_id,
      );
      if (!membership) {
        return actionFail(
          "NO_MEMBERSHIP",
          "You do not belong to this restaurant.",
        );
      }
      await setRestaurantPreferenceCookie(branch.restaurant_id);
    }

    await setBranchPreferenceCookie(branch.id);
    revalidatePath("/", "layout");
    revalidatePath(SETTINGS_BRANCHES_PATH);
    return actionOk({ branchId: branch.id });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to switch branch.");
  }
}

export async function clearContextCookiesAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(RESTAURANT_PREFERENCE_COOKIE);
  cookieStore.delete(BRANCH_PREFERENCE_COOKIE);
}
