import { publicBranchSlugParamsSchema } from "@/lib/validations/public-queue";
import {
  publicQueueJsonFromResult,
  publicQueueRateLimitResponse,
} from "@/lib/api/public-queue";
import { jsonFail } from "@/lib/api/json";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import { getPublicQueueInfo } from "@/services/public-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantSlug: string; branchSlug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = publicQueueRateLimitResponse(request, "discovery");
  if (limited) return limited;

  const { restaurantSlug, branchSlug } = await context.params;
  const parsed = publicBranchSlugParamsSchema.safeParse({
    restaurantSlug,
    branchSlug,
  });
  if (!parsed.success) {
    return jsonFail("NOT_FOUND", PUBLIC_QUEUE_MESSAGES.notFound, 404);
  }

  const result = await getPublicQueueInfo(
    parsed.data.restaurantSlug,
    parsed.data.branchSlug,
  );
  return publicQueueJsonFromResult(result);
}
