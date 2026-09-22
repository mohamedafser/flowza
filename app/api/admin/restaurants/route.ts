import { adminJsonOk, handleAdminError, parseAdminQuery } from "@/lib/api/admin";
import { readJsonBody } from "@/lib/api/json";
import { jsonFail } from "@/lib/api/json";
import {
  adminRestaurantListSchema,
  adminRestaurantStatusSchema,
} from "@/lib/validations/admin";
import {
  listAdminRestaurants,
  updateAdminRestaurantStatus,
} from "@/services/admin/admin-restaurants.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseAdminQuery(adminRestaurantListSchema, url.searchParams);
    if (!parsed.ok) return parsed.response;
    const data = await listAdminRestaurants(parsed.data);
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return jsonFail("VALIDATION", "Restaurant id is required.", 400);
    }
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = adminRestaurantStatusSchema.safeParse(body.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid status.",
        400,
      );
    }
    const data = await updateAdminRestaurantStatus(id, parsed.data.status);
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}
