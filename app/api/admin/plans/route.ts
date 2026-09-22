import { adminJsonOk, handleAdminError } from "@/lib/api/admin";
import { jsonFail, readJsonBody } from "@/lib/api/json";
import { adminPlanUpsertSchema } from "@/lib/validations/admin";
import {
  createAdminPlan,
  listAdminPlans,
} from "@/services/admin/admin-plans.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listAdminPlans();
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function POST(request: Request) {
  try {
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
    const data = await createAdminPlan(parsed.data);
    return adminJsonOk(data, 201);
  } catch (error) {
    return handleAdminError(error);
  }
}
