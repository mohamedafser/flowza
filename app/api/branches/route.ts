import { revalidatePath } from "next/cache";
import { AuthorizationError, requireVerifiedAuth } from "@/lib/auth/guards";
import {
  jsonFail,
  jsonFromAuthorizationError,
  jsonOk,
  readJsonBody,
  statusForActionCode,
} from "@/lib/api/json";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import {
  createBranchSchema,
  parseBranchListQuery,
  toBranchPayload,
} from "@/lib/validations/branch";
import { createBranch, searchBranches } from "@/services/branches";

export const dynamic = "force-dynamic";

/**
 * GET /api/branches
 * Paginated, filtered branch list (plain JSON).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireVerifiedAuth();
    const restaurantId = auth.restaurant?.id;

    if (!restaurantId) {
      return jsonFail(
        "NO_MEMBERSHIP",
        "Create or select a restaurant first.",
        404,
      );
    }

    const { searchParams } = new URL(request.url);
    const query = parseBranchListQuery(
      Object.fromEntries(searchParams.entries()),
    );

    let result = await searchBranches(restaurantId, query);

    if (result.totalPages > 0 && query.page > result.totalPages) {
      result = await searchBranches(restaurantId, {
        ...query,
        page: result.totalPages,
      });
    }

    return jsonOk({
      items: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        offset: result.offset,
      },
      filters: result.filters,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to load branches.", 500);
  }
}

/**
 * POST /api/branches
 * Create a branch (plain JSON).
 */
export async function POST(request: Request) {
  try {
    await requireVerifiedAuth();

    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const parsed = createBranchSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return jsonFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid branch details.",
        400,
      );
    }

    const { restaurantId, ...fields } = parsed.data;
    const result = await createBranch({
      restaurantId,
      ...toBranchPayload(fields),
    });

    if (!result.ok) {
      return jsonFail(
        result.code,
        result.message,
        statusForActionCode(result.code),
      );
    }

    revalidatePath(SETTINGS_BRANCHES_PATH);
    revalidatePath("/", "layout");

    return jsonOk({ branch: result.branch }, 201);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonFromAuthorizationError(error);
    }
    return jsonFail("UNKNOWN", "Unable to create branch.", 500);
  }
}
