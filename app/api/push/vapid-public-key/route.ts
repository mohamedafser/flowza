import { NextResponse } from "next/server";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/notifications/push/config";
import { jsonFail, jsonOk } from "@/lib/api/json";

export const dynamic = "force-dynamic";

/** GET /api/push/vapid-public-key — public VAPID key for PushManager.subscribe */
export async function GET() {
  if (!isWebPushConfigured()) {
    return jsonFail(
      "NOT_FOUND",
      "Web Push is not configured on this server.",
      404,
    );
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return jsonFail(
      "NOT_FOUND",
      "Web Push is not configured on this server.",
      404,
    );
  }

  return jsonOk({ publicKey, configured: true });
}
