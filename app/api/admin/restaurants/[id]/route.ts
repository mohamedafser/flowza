import { adminJsonOk, handleAdminError } from "@/lib/api/admin";
import { jsonFail, readJsonBody } from "@/lib/api/json";
import { adminRestaurantStatusSchema } from "@/lib/validations/admin";
import {
  getAdminRestaurantDetail,
  updateAdminRestaurantStatus,
} from "@/services/admin/admin-restaurants.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getAdminRestaurantDetail(id);
    if (!data) {
      return jsonFail("NOT_FOUND", "Restaurant not found.", 404);
    }
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
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
