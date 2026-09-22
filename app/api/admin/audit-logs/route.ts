import { adminJsonOk, handleAdminError, parseAdminQuery } from "@/lib/api/admin";
import { adminAuditListSchema } from "@/lib/validations/admin";
import { listAdminAuditLogs } from "@/services/admin/admin-audit.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseAdminQuery(adminAuditListSchema, url.searchParams);
    if (!parsed.ok) return parsed.response;
    return adminJsonOk(await listAdminAuditLogs(parsed.data));
  } catch (error) {
    return handleAdminError(error);
  }
}
