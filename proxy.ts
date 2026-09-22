import { type NextRequest } from "next/server";
import { enforceSensitiveApiRateLimit } from "@/lib/api/rate-limit-response";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const limited = enforceSensitiveApiRateLimit(request);
  if (limited) {
    return limited;
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|workbox-.*|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
