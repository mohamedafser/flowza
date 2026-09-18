import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_OVERVIEW_PATH,
  LOGIN_PATH,
  ONBOARDING_RESTAURANT_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  safeRedirectPath,
} from "@/lib/auth/paths";
import { getSupabasePublishableKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorDescription = searchParams.get("error_description");
  const nextParam = searchParams.get("next");
  const next = safeRedirectPath(nextParam);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabasePublishableKey();

  if (!supabaseUrl || !anonKey) {
    return NextResponse.redirect(new URL(LOGIN_PATH, origin));
  }

  if (errorDescription) {
    const target =
      type === "recovery" || nextParam === RESET_PASSWORD_PATH
        ? LOGIN_PATH
        : VERIFY_EMAIL_PATH;
    const url = new URL(target, origin);
    url.searchParams.set("error", "link_invalid");
    return NextResponse.redirect(url);
  }

  let redirectUrl = new URL(next, origin);
  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        redirectUrl = new URL(next, origin);
        response = NextResponse.redirect(redirectUrl);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let exchangeError: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      exchangeError = error.message;
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "email" | "recovery" | "invite" | "magiclink",
      token_hash: tokenHash,
    });
    if (error) {
      exchangeError = error.message;
    }
  } else {
    exchangeError = "missing_code";
  }

  if (exchangeError) {
    const url = new URL(LOGIN_PATH, origin);
    url.searchParams.set("error", "link_invalid");
    const failure = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      failure.cookies.set(cookie.name, cookie.value);
    });
    return failure;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRecovery = type === "recovery" || nextParam === RESET_PASSWORD_PATH;

  let destination = next;
  if (isRecovery) {
    destination = RESET_PASSWORD_PATH;
  } else if (user && !user.email_confirmed_at) {
    destination = VERIFY_EMAIL_PATH;
  } else if (user?.email_confirmed_at) {
    const { data: membershipRows } = await supabase
      .from("restaurant_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .limit(1);

    const hasRestaurant = (membershipRows?.length ?? 0) > 0;
    if (
      next === RESET_PASSWORD_PATH ||
      next === VERIFY_EMAIL_PATH ||
      next === DASHBOARD_OVERVIEW_PATH
    ) {
      destination = hasRestaurant
        ? DASHBOARD_OVERVIEW_PATH
        : ONBOARDING_RESTAURANT_PATH;
    } else {
      destination = next;
    }
  } else {
    destination = LOGIN_PATH;
  }

  const finalUrl = new URL(destination, origin);
  const finalResponse = NextResponse.redirect(finalUrl);
  response.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value);
  });
  return finalResponse;
}
