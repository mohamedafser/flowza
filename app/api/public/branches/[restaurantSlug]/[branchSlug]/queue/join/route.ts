import { publicBranchSlugParamsSchema } from "@/lib/validations/public-queue";
import {
  publicQueueJsonFromResult,
  publicQueueRateLimitResponse,
} from "@/lib/api/public-queue";
import { jsonFail, readJsonBody } from "@/lib/api/json";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import { joinPublicQueue } from "@/services/public-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ restaurantSlug: string; branchSlug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const limited = publicQueueRateLimitResponse(request, "join");
  if (limited) return limited;

  const { restaurantSlug, branchSlug } = await context.params;
  const parsedParams = publicBranchSlugParamsSchema.safeParse({
    restaurantSlug,
    branchSlug,
  });
  if (!parsedParams.success) {
    return jsonFail("NOT_FOUND", PUBLIC_QUEUE_MESSAGES.notFound, 404);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return body.response;
  }

  const payload =
    body.body && typeof body.body === "object"
      ? (body.body as Record<string, unknown>)
      : {};

  const result = await joinPublicQueue({
    restaurantSlug: parsedParams.data.restaurantSlug,
    branchSlug: parsedParams.data.branchSlug,
    name: payload.name,
    phone: payload.phone,
    partySize: payload.partySize,
  });
  return publicQueueJsonFromResult(result);
}
