import { NextResponse } from "next/server";
import {
  publicQRJsonFromResult,
  publicQRRateLimitResponse,
} from "@/lib/api/public-qr";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import { publicQRTokenParamSchema } from "@/lib/validations/qr-code";
import { getPublicQRCode } from "@/services/qr-codes";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limited = publicQRRateLimitResponse(request);
  if (limited) return limited;

  const { publicToken } = await context.params;
  const parsed = publicQRTokenParamSchema.safeParse({ publicToken });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QR_MESSAGES.notFound,
      },
      { status: 404 },
    );
  }

  const result = await getPublicQRCode(parsed.data.publicToken);
  return publicQRJsonFromResult(result);
}
