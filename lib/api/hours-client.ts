import { JSON_HEADERS, parseJsonResult } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type { SpecialHoursEntry, WeekSchedule } from "@/lib/utils/hours";

export async function updateRestaurantHoursRequest(
  restaurantId: string,
  days: WeekSchedule,
): Promise<ActionResult<{ days: WeekSchedule }>> {
  const response = await fetch(`/api/restaurants/${restaurantId}/hours`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ days }),
  });
  return parseJsonResult(response);
}

export async function updateBranchHoursRequest(
  branchId: string,
  days: WeekSchedule,
): Promise<ActionResult<{ days: WeekSchedule }>> {
  const response = await fetch(`/api/branches/${branchId}/hours`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ days }),
  });
  return parseJsonResult(response);
}

export async function clearBranchHoursRequest(
  branchId: string,
): Promise<ActionResult<{ cleared: true }>> {
  const response = await fetch(`/api/branches/${branchId}/hours`, {
    method: "DELETE",
    headers: JSON_HEADERS,
  });
  return parseJsonResult(response);
}

export type SpecialHoursPayload = {
  date: string;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  reason?: string | null;
  branchId?: string | null;
};

export async function createSpecialHoursRequest(
  restaurantId: string,
  payload: SpecialHoursPayload,
): Promise<ActionResult<{ entry: SpecialHoursEntry & { id: string } }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/special-hours`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    },
  );
  return parseJsonResult(response);
}

export async function updateSpecialHoursRequest(
  restaurantId: string,
  specialHoursId: string,
  payload: SpecialHoursPayload,
): Promise<ActionResult<{ entry: SpecialHoursEntry & { id: string } }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/special-hours/${specialHoursId}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    },
  );
  return parseJsonResult(response);
}

export async function deleteSpecialHoursRequest(
  restaurantId: string,
  specialHoursId: string,
): Promise<ActionResult<{ deleted: true }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/special-hours/${specialHoursId}`,
    {
      method: "DELETE",
      headers: JSON_HEADERS,
    },
  );
  return parseJsonResult(response);
}
