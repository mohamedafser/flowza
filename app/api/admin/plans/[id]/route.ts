import { adminJsonOk, handleAdminError } from "@/lib/api/admin";
import { jsonFail, readJsonBody } from "@/lib/api/json";
import { adminPlanUpsertSchema } from "@/lib/validations/admin";
import { z } from "zod";
import {
  getAdminPlan,
  setAdminPlanActive,
  updateAdminPlan,
} from "@/services/admin/admin-plans.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getAdminPlan(id);
    if (!data) return jsonFail("NOT_FOUND", "Plan not found.", 404);
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = adminPlanUpsertSchema.safeParse(body.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid plan.",
        400,
      );
    }
    return adminJsonOk(await updateAdminPlan(id, parsed.data));
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = z
      .object({ isActive: z.boolean() })
      .safeParse(body.body);
    if (!parsed.success) {
      return jsonFail("VALIDATION", "isActive is required.", 400);
    }
    return adminJsonOk(await setAdminPlanActive(id, parsed.data.isActive));
  } catch (error) {
    return handleAdminError(error);
  }
}
