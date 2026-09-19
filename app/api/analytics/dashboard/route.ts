import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
} from "@/lib/api/json";
import {
  analyticsQuerySchema,
  firstZodMessage,
} from "@/lib/validations/analytics";
import { getDashboardOverview } from "@/services/analytics/dashboard";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/dashboard?branchId=&preset=&startDate=&endDate=&compareBranchIds=
 */
export async function GET(request: Request) {
  try {
    await requireVerifiedAuth();

    const url = new URL(request.url);
    const compareRaw = url.searchParams.getAll("compareBranchIds");
    const compareFromCsv = url.searchParams.get("compareBranchIds");
    const compareBranchIds =
      compareRaw.length > 1
        ? compareRaw
        : compareFromCsv
          ? compareFromCsv
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined;

    const parsed = analyticsQuerySchema.safeParse({
      branchId: url.searchParams.get("branchId"),
      preset: url.searchParams.get("preset") ?? undefined,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      compareBranchIds,
    });

    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        firstZodMessage(parsed.error, "Invalid analytics query."),
        400,
      );
    }

    const bundle = await getDashboardOverview(parsed.data);
    return jsonOk(bundle);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    if (error instanceof Error && /date range/i.test(error.message)) {
      return jsonFail("VALIDATION", error.message, 400);
    }
    return jsonFail("UNKNOWN", "Unable to load dashboard analytics.", 500);
  }
}
