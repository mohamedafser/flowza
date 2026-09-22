import { readJsonBody } from "@/lib/api/json";
import { jsonFromAuthFlow } from "@/lib/api/auth-response";
import { resendOtp } from "@/services/auth/flows";

export const dynamic = "force-dynamic";

/** POST /api/auth/resend-otp */
export async function POST(request: Request) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  return jsonFromAuthFlow(await resendOtp(parsedBody.body));
}
