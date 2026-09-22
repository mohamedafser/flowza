import { readJsonBody } from "@/lib/api/json";
import { jsonFromAuthFlow } from "@/lib/api/auth-response";
import { forgotPassword } from "@/services/auth/flows";

export const dynamic = "force-dynamic";

/** POST /api/auth/forgot-password */
export async function POST(request: Request) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  return jsonFromAuthFlow(await forgotPassword(parsedBody.body));
}
