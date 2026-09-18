import {
  publicDisplayJsonFromResult,
  publicDisplayRateLimitResponse,
} from "@/lib/api/public-display";
import { jsonFail } from "@/lib/api/json";
import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import { publicDisplayTokenParamSchema } from "@/lib/validations/public-display";
import { getPublicDisplay } from "@/services/displays";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = publicDisplayRateLimitResponse(request);
  if (limited) return limited;

  const { publicToken } = await context.params;
  const parsed = publicDisplayTokenParamSchema.safeParse({ publicToken });
  if (!parsed.success) {
    return jsonFail("NOT_FOUND", PUBLIC_DISPLAY_MESSAGES.notFound, 404);
  }

  const result = await getPublicDisplay(parsed.data.publicToken);
  return publicDisplayJsonFromResult(result);
}
