import { adminJsonOk, handleAdminError } from "@/lib/api/admin";
import { jsonFail, readJsonBody } from "@/lib/api/json";
import { adminSettingsUpdateSchema } from "@/lib/validations/admin";
import {
  getPlatformSettingsForAdmin,
  updatePlatformSettings,
} from "@/services/admin/admin-settings.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return adminJsonOk(await getPlatformSettingsForAdmin());
  } catch (error) {
    return handleAdminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = adminSettingsUpdateSchema.safeParse(body.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid settings.",
        400,
      );
    }
    return adminJsonOk(await updatePlatformSettings(parsed.data));
  } catch (error) {
    return handleAdminError(error);
  }
}
