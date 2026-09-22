import { adminJsonOk, handleAdminError, parseAdminQuery } from "@/lib/api/admin";
import { adminUserListSchema } from "@/lib/validations/admin";
import { listAdminUsers } from "@/services/admin/admin-users.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = parseAdminQuery(adminUserListSchema, url.searchParams);
    if (!parsed.ok) return parsed.response;
    const data = await listAdminUsers(parsed.data);
    return adminJsonOk(data);
  } catch (error) {
    return handleAdminError(error);
  }
}
