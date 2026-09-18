"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  SETTINGS_CUSTOMER_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_QUEUE_PATH,
  SETTINGS_RESTAURANT_PATH,
} from "@/lib/auth/paths";
import {
  customerExperienceUpdateSchema,
  generalSettingsUpdateSchema,
  queueSettingsUpdateSchema,
} from "@/lib/validations/settings";
import {
  updateCustomerExperienceSettings,
  updateGeneralSettings,
  updateQueueSettings,
  type RestaurantSettings,
} from "@/services/settings";

function revalidateSettings() {
  revalidatePath(SETTINGS_GENERAL_PATH);
  revalidatePath(SETTINGS_RESTAURANT_PATH);
  revalidatePath(SETTINGS_QUEUE_PATH);
  revalidatePath(SETTINGS_CUSTOMER_PATH);
  revalidatePath("/", "layout");
}

export async function updateGeneralSettingsAction(
  input: unknown,
): Promise<ActionResult<{ restaurantId: string }>> {
  try {
    const parsed = generalSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid settings.",
      );
    }

    const { restaurantId, ...fields } = parsed.data;
    const result = await updateGeneralSettings(restaurantId, fields);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateSettings();
    return actionOk({ restaurantId });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update settings.");
  }
}

export async function updateQueueSettingsAction(
  input: unknown,
): Promise<ActionResult<{ settings: RestaurantSettings }>> {
  try {
    const parsed = queueSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid queue settings.",
      );
    }

    const { restaurantId, ...fields } = parsed.data;
    const result = await updateQueueSettings(restaurantId, fields);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateSettings();
    return actionOk({ settings: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update queue settings.");
  }
}

export async function updateCustomerExperienceAction(
  input: unknown,
): Promise<ActionResult<{ settings: RestaurantSettings }>> {
  try {
    const parsed = customerExperienceUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid customer settings.",
      );
    }

    const { restaurantId, ...fields } = parsed.data;
    const result = await updateCustomerExperienceSettings(restaurantId, fields);
    if (!result.ok) {
      return actionFail(result.code, result.message);
    }

    revalidateSettings();
    return actionOk({ settings: result.data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update customer settings.");
  }
}
