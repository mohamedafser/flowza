import { jsonOk } from "@/lib/api/json";
import { signOut } from "@/services/auth/flows";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout */
export async function POST() {
  await signOut();
  return jsonOk({ redirectTo: "/login" });
}
