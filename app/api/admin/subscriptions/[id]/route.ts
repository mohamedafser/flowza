import { adminJsonOk, handleAdminError } from "@/lib/api/admin";
import { jsonFail, readJsonBody } from "@/lib/api/json";
import {
  adminChangePlanSchema,
  adminExtendTrialSchema,
} from "@/lib/validations/admin";
import {
  adminCancelSubscription,
  adminChangeSubscriptionPlan,
  adminExtendTrial,
  adminReactivateSubscription,
  getAdminSubscriptionDetail,
} from "@/services/admin/admin-subscriptions.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getAdminSubscriptionDetail(id);
    if (!data) {
      return jsonFail("NOT_FOUND", "Subscription not found.", 404);
    }
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const action =
      body.body &&
      typeof body.body === "object" &&
      "action" in body.body &&
      typeof (body.body as { action: unknown }).action === "string"
        ? (body.body as { action: string }).action
        : null;

    if (action === "cancel") {
      return adminJsonOk(await adminCancelSubscription(id));
    }
    if (action === "reactivate") {
      return adminJsonOk(await adminReactivateSubscription(id));
    }
    if (action === "change_plan") {
      const parsed = adminChangePlanSchema.safeParse(body.body);
      if (!parsed.success) {
        return jsonFail(
          "VALIDATION",
          parsed.error.issues[0]?.message ?? "Invalid plan change.",
          400,
        );
      }
      return adminJsonOk(await adminChangeSubscriptionPlan(id, parsed.data));
    }
    if (action === "extend_trial") {
      const parsed = adminExtendTrialSchema.safeParse(body.body);
      if (!parsed.success) {
        return jsonFail(
          "VALIDATION",
          parsed.error.issues[0]?.message ?? "Invalid trial extension.",
          400,
        );
      }
      return adminJsonOk(await adminExtendTrial(id, parsed.data));
    }

    return jsonFail("VALIDATION", "Unknown subscription action.", 400);
  } catch (error) {
    return handleAdminError(error);
  }
}
