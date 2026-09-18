import { publicAccessTokenSchema } from "@/lib/validations/public-queue";
import {
  publicQueueJsonFromResult,
  publicQueueRateLimitResponse,
} from "@/lib/api/public-queue";
import { jsonFail } from "@/lib/api/json";
import { PUBLIC_QUEUE_MESSAGES } from "@/lib/public-queue/messages";
import { getPublicQueueStatus } from "@/services/public-queue";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ accessToken: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = publicQueueRateLimitResponse(request, "status");
  if (limited) return limited;

  const { accessToken } = await context.params;
  const parsed = publicAccessTokenSchema.safeParse(accessToken);
  if (!parsed.success) {
    return jsonFail("NOT_FOUND", PUBLIC_QUEUE_MESSAGES.invalidToken, 404);
  }

  const result = await getPublicQueueStatus(parsed.data);
  return publicQueueJsonFromResult(result);
}
