import {
  publicBranchSlugParamsSchema,
  searchPublicQueueCustomersSchema,
} from "@/lib/validations/public-queue";
import {
  publicQueueJsonFromResult,
  publicQueueRateLimitResponse,
} from "@/lib/api/public-queue";
import { jsonFail } from "@/lib/api/json";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import { searchPublicQueueCustomers } from "@/services/public-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantSlug: string; branchSlug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = publicQueueRateLimitResponse(request, "search");
  if (limited) return limited;

  const { restaurantSlug, branchSlug } = await context.params;
  const parsedParams = publicBranchSlugParamsSchema.safeParse({
    restaurantSlug,
    branchSlug,
  });
  if (!parsedParams.success) {
    return jsonFail("NOT_FOUND", PUBLIC_QUEUE_MESSAGES.notFound, 404);
  }

  const url = new URL(request.url);
  const parsedQuery = searchPublicQueueCustomersSchema.safeParse({
    query: url.searchParams.get("query") ?? "",
  });
  if (!parsedQuery.success) {
    return jsonFail(
      "VALIDATION",
      parsedQuery.error.issues[0]?.message ?? "Enter a name or phone to search.",
      400,
    );
  }

  const result = await searchPublicQueueCustomers({
    restaurantSlug: parsedParams.data.restaurantSlug,
    branchSlug: parsedParams.data.branchSlug,
    query: parsedQuery.data.query,
  });
  return publicQueueJsonFromResult(result);
}
