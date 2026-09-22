import { adminJsonOk, handleAdminError, parseAdminQuery } from "@/lib/api/admin";
import { adminSubscriptionListSchema } from "@/lib/validations/admin";
import { listAdminSubscriptions } from "@/services/admin/admin-subscriptions.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseAdminQuery(
      adminSubscriptionListSchema,
      url.searchParams,
    );
    if (!parsed.ok) return parsed.response;
    const data = await listAdminSubscriptions(parsed.data);
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}
