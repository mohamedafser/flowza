import {
  jsonFail,
  jsonOk,
  readJsonBody,
} from "@/lib/api/json";
import { isWebPushConfigured } from "@/lib/notifications/push/config";
import { publicAccessTokenSchema } from "@/lib/validations/public-queue";
import {
  deleteCustomerPushSubscription,
  pushSubscriptionSchema,
  upsertCustomerPushSubscription,
} from "@/services/push";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ accessToken: string }>;
};

const subscribeBodySchema = z.object({
  subscription: pushSubscriptionSchema,
  clickUrl: z.string().url().max(2048).optional(),
});

const unsubscribeBodySchema = z.object({
  endpoint: z.string().url().max(2048),
});

/** POST /api/public/queue/[accessToken]/push — guest device opt-in */
export async function POST(request: Request, context: RouteContext) {
  if (!isWebPushConfigured()) {
    return jsonFail(
      "VALIDATION",
      "Web Push is not configured on this server.",
      400,
    );
  }

  const { accessToken: rawToken } = await context.params;
  const tokenParsed = publicAccessTokenSchema.safeParse(rawToken);
  if (!tokenParsed.success) {
    return jsonFail("NOT_FOUND", "Queue entry not found.", 404);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = subscribeBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid subscription.",
      400,
    );
  }

  const referer = request.headers.get("referer");
  const clickUrl =
    parsed.data.clickUrl ||
    (referer && referer.startsWith("http") ? referer : undefined) ||
    new URL(request.url).origin;

  const result = await upsertCustomerPushSubscription({
    accessToken: tokenParsed.data,
    subscription: parsed.data.subscription,
    clickUrl,
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return jsonFail("NOT_FOUND", result.message, 404);
  }

  return jsonOk({ id: result.id });
}

/** DELETE /api/public/queue/[accessToken]/push — guest device opt-out */
export async function DELETE(request: Request, context: RouteContext) {
  const { accessToken: rawToken } = await context.params;
  const tokenParsed = publicAccessTokenSchema.safeParse(rawToken);
  if (!tokenParsed.success) {
    return jsonFail("NOT_FOUND", "Queue entry not found.", 404);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = unsubscribeBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return jsonFail(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Invalid request.",
      400,
    );
  }

  const result = await deleteCustomerPushSubscription({
    accessToken: tokenParsed.data,
    endpoint: parsed.data.endpoint,
  });

  if (!result.ok) {
    return jsonFail("NOT_FOUND", result.message, 404);
  }

  return jsonOk({ removed: true });
}
