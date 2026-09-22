import { handleAdminError, adminJsonOk } from "@/lib/api/admin";
import { getAdminDashboardMetrics } from "@/services/admin/admin-dashboard.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getAdminDashboardMetrics();
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}
