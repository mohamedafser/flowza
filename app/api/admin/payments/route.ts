import { adminJsonOk, handleAdminError, parseAdminQuery } from "@/lib/api/admin";
import {
  adminPaymentListSchema,
  adminRevenueRangeSchema,
} from "@/lib/validations/admin";
import {
  getAdminRevenueAnalytics,
  listAdminPayments,
} from "@/services/admin/admin-payments.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("analytics") === "1") {
      const parsed = parseAdminQuery(adminRevenueRangeSchema, url.searchParams);
      if (!parsed.ok) return parsed.response;
      return adminJsonOk(await getAdminRevenueAnalytics(parsed.data));
    }

    const parsed = parseAdminQuery(adminPaymentListSchema, url.searchParams);
    if (!parsed.ok) return parsed.response;
    return adminJsonOk(await listAdminPayments(parsed.data));
  } catch (error) {
    return handleAdminError(error);
  }
}
