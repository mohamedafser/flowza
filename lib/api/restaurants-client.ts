import { JSON_ACCEPT, JSON_HEADERS, parseJsonResult } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type { Restaurant } from "@/lib/auth/session";
import type { RestaurantFormValues } from "@/lib/validations/restaurant";

export async function createRestaurantRequest(
  values: RestaurantFormValues,
): Promise<ActionResult<{ restaurantId: string; redirectTo: string }>> {
  const response = await fetch("/api/restaurants", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function updateRestaurantRequest(
  restaurantId: string,
  values: RestaurantFormValues,
): Promise<ActionResult<{ restaurant: Restaurant }>> {
  const response = await fetch(`/api/restaurants/${restaurantId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
  return parseJsonResult(response);
}

export async function uploadRestaurantLogoRequest(
  restaurantId: string,
  file: File,
): Promise<ActionResult<{ logoUrl: string }>> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`/api/restaurants/${restaurantId}/logo`, {
    method: "POST",
    headers: JSON_ACCEPT,
    body: formData,
  });
  return parseJsonResult(response);
}

export async function removeRestaurantLogoRequest(
  restaurantId: string,
): Promise<ActionResult> {
  const response = await fetch(`/api/restaurants/${restaurantId}/logo`, {
    method: "DELETE",
    headers: JSON_ACCEPT,
  });
  return parseJsonResult(response);
}

export async function switchRestaurantRequest(
  restaurantId: string,
): Promise<ActionResult<{ restaurantId: string }>> {
  const response = await fetch("/api/context/restaurant", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ restaurantId }),
  });
  return parseJsonResult(response);
}

export async function switchBranchRequest(
  branchId: string,
): Promise<ActionResult<{ branchId: string }>> {
  const response = await fetch("/api/context/branch", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ branchId }),
  });
  return parseJsonResult(response);
}
