import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
} from "@/lib/api/json";
import {
  analyticsExportSchema,
  firstZodMessage,
} from "@/lib/validations/analytics";
import { exportAnalyticsCsv } from "@/services/analytics/export";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/export?branchId=&preset=&kind=&startDate=&endDate=
 */
export async function GET(request: Request) {
  try {
    await requireVerifiedAuth();

    const url = new URL(request.url);
    const parsed = analyticsExportSchema.safeParse({
      branchId: url.searchParams.get("branchId"),
      preset: url.searchParams.get("preset") ?? undefined,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      kind: url.searchParams.get("kind"),
    });

    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid export request."),
        400,
      );
    }

    const { filename, csv } = await exportAnalyticsCsv(parsed.data);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    if (error instanceof Error && error.message.includes("date range")) {
      return jsonFail("VALIDATION", error.message, 400);
    }
    return jsonFail("UNKNOWN", "Unable to export analytics.", 500);
  }
}
