import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  statusForActionCode,
} from "@/lib/api/json";
import {
  SETTINGS_GENERAL_PATH,
  SETTINGS_RESTAURANT_PATH,
} from "@/lib/auth/paths";
import { removeRestaurantLogo, uploadRestaurantLogo } from "@/services/storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantId: string }>;
};

/**
 * POST /api/restaurants/[restaurantId]/logo
 * multipart/form-data with `file`
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonFail("VALIDATION", "Choose an image file to upload.", 400);
    }

    const result = await uploadRestaurantLogo(restaurantId, file);
    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath("/", "layout");

    return jsonOk({ logoUrl: result.logoUrl });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to upload logo.", 500);
  }
}

/**
 * DELETE /api/restaurants/[restaurantId]/logo
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { restaurantId } = await context.params;
    const result = await removeRestaurantLogo(restaurantId);

    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_RESTAURANT_PATH);
    revalidatePath(SETTINGS_GENERAL_PATH);
    revalidatePath("/", "layout");

    return jsonOk({ removed: true });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to remove logo.", 500);
  }
}
