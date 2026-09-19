import { JSON_HEADERS, parseJsonResult } from "@/lib/api/client";
import type { ActionResult } from "@/lib/errors/action";
import type {
  CustomerExperienceValues,
  GeneralSettingsValues,
  QueueSettingsValues,
} from "@/lib/validations/settings";
import type { RestaurantSettings } from "@/services/settings";

export async function updateGeneralSettingsRequest(
  restaurantId: string,
  values: GeneralSettingsValues,
): Promise<ActionResult<{ restaurantId: string }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/settings/general`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(values),
    },
  );
  return parseJsonResult(response);
}

export async function updateQueueSettingsRequest(
  restaurantId: string,
  values: QueueSettingsValues,
): Promise<ActionResult<{ settings: RestaurantSettings }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/settings/queue`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(values),
    },
  );
  return parseJsonResult(response);
}

export async function updateCustomerExperienceRequest(
  restaurantId: string,
  values: CustomerExperienceValues,
): Promise<ActionResult<{ settings: RestaurantSettings }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/settings/customer`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(values),
    },
  );
  return parseJsonResult(response);
}

export async function updateNotificationSettingsRequest(
  restaurantId: string,
  values: import("@/lib/validations/notifications").NotificationSettingsValues,
): Promise<ActionResult<{ settings: RestaurantSettings }>> {
  const response = await fetch(
    `/api/restaurants/${restaurantId}/settings/notifications`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(values),
    },
  );
  return parseJsonResult(response);
}
