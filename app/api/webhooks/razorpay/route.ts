import { NextResponse } from "next/server";
import { processRazorpayWebhook } from "@/services/billing/billing.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/razorpay
 * Signature-verified, idempotent subscription/payment webhooks.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");

  const result = await processRazorpayWebhook({
    rawBody,
    signature,
    eventId,
  });

  if (!result.ok) {
    const status = /signature/i.test(result.message) ? 401 : 500;
    return NextResponse.json(
      { ok: false, message: result.message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, duplicate: result.duplicate === true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
