import { requirePermission } from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import {
  isAllowedLogoMimeType,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES,
} from "@/lib/validations/restaurant";
import { updateRestaurantLogoUrl } from "@/services/restaurants";
import { createClient } from "@/lib/supabase/server";
import type { Restaurant } from "@/lib/auth/session";

export const RESTAURANT_LOGOS_BUCKET = "restaurant-logos";

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${RESTAURANT_LOGOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return decodeURIComponent(url.slice(index + marker.length));
}

export type UploadLogoResult =
  | { ok: true; restaurant: Restaurant; logoUrl: string }
  | {
      ok: false;
      message: string;
      code: "VALIDATION" | "FORBIDDEN" | "STORAGE" | "UNKNOWN";
    };

export async function uploadRestaurantLogo(
  restaurantId: string,
  file: File,
): Promise<UploadLogoResult> {
  await requirePermission(restaurantId, "restaurant.manage");

  if (!isAllowedLogoMimeType(file.type)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `Logo must be one of: ${LOGO_ALLOWED_MIME_TYPES.join(", ")}.`,
    };
  }

  if (file.size <= 0 || file.size > LOGO_MAX_BYTES) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Logo must be an image up to 2 MB.",
    };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("restaurants")
    .select("logo_url")
    .eq("id", restaurantId)
    .maybeSingle();

  const objectPath = `${restaurantId}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(RESTAURANT_LOGOS_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      code: "STORAGE",
      message: safeDatabaseMessage(
        uploadError,
        "Unable to upload logo. Please try again.",
      ),
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(RESTAURANT_LOGOS_BUCKET).getPublicUrl(objectPath);

  const updateResult = await updateRestaurantLogoUrl(restaurantId, publicUrl);
  if (!updateResult.ok) {
    await supabase.storage.from(RESTAURANT_LOGOS_BUCKET).remove([objectPath]);
    return {
      ok: false,
      code: "UNKNOWN",
      message: updateResult.message,
    };
  }

  const previousPath = existing?.logo_url
    ? pathFromPublicUrl(existing.logo_url)
    : null;
  if (previousPath && previousPath.startsWith(`${restaurantId}/`)) {
    await supabase.storage.from(RESTAURANT_LOGOS_BUCKET).remove([previousPath]);
  }

  return {
    ok: true,
    restaurant: updateResult.restaurant,
    logoUrl: publicUrl,
  };
}

export async function removeRestaurantLogo(
  restaurantId: string,
): Promise<
  UploadLogoResult | { ok: true; restaurant: Restaurant; logoUrl: null }
> {
  await requirePermission(restaurantId, "restaurant.manage");
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("restaurants")
    .select("logo_url")
    .eq("id", restaurantId)
    .maybeSingle();

  const updateResult = await updateRestaurantLogoUrl(restaurantId, null);
  if (!updateResult.ok) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: updateResult.message,
    };
  }

  const previousPath = existing?.logo_url
    ? pathFromPublicUrl(existing.logo_url)
    : null;
  if (previousPath && previousPath.startsWith(`${restaurantId}/`)) {
    await supabase.storage.from(RESTAURANT_LOGOS_BUCKET).remove([previousPath]);
  }

  return { ok: true, restaurant: updateResult.restaurant, logoUrl: null };
}
