import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_OVERVIEW_PATH,
  LOGIN_PATH,
  RESET_PASSWORD_PATH,
  VERIFY_EMAIL_PATH,
  VERIFY_RESET_OTP_PATH,
  isAuthPagePath,
  isProtectedPath,
  isPublicAuthAssetPath,
  safeRedirectPath,
} from "@/lib/auth/paths";
import { getSupabasePublishableKey } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

function redirectTo(
  request: NextRequest,
  pathname: string,
  initCookies: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  if (pathname === LOGIN_PATH && isProtectedPath(request.nextUrl.pathname)) {
    url.searchParams.set(
      "next",
      safeRedirectPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
  }

  const response = NextResponse.redirect(url);
  initCookies.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabasePublishableKey();
  const { pathname } = request.nextUrl;

  if (!url || !anonKey) {
    // Without Supabase config, keep public pages available for Phase 1 smoke.
    if (
      isProtectedPath(pathname) ||
      pathname === VERIFY_EMAIL_PATH ||
      pathname === RESET_PASSWORD_PATH
    ) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isVerified = Boolean(user?.email_confirmed_at);
  const isProtected = isProtectedPath(pathname);
  const isAuthPage = isAuthPagePath(pathname);
  const isVerifyEmail = pathname === VERIFY_EMAIL_PATH;
  const isResetPassword = pathname === RESET_PASSWORD_PATH;
  const isVerifyResetOtp = pathname === VERIFY_RESET_OTP_PATH;
  const hasPasswordResetCookie = Boolean(
    request.cookies.get("flowza_password_reset")?.value,
  );

  if (isPublicAuthAssetPath(pathname)) {
    return supabaseResponse;
  }

  if (isProtected) {
    if (!user) {
      return redirectTo(request, LOGIN_PATH, supabaseResponse);
    }
    if (!isVerified) {
      return redirectTo(request, VERIFY_EMAIL_PATH, supabaseResponse);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.account_status === "DISABLED") {
      await supabase.auth.signOut();
      return redirectTo(request, LOGIN_PATH, supabaseResponse);
    }

    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, max-age=0, must-revalidate",
    );
    return supabaseResponse;
  }

  if (user && isVerified) {
    if (
      pathname === LOGIN_PATH ||
      pathname === "/signup" ||
      pathname === "/forgot-password" ||
      isVerifyEmail ||
      isVerifyResetOtp
    ) {
      return redirectTo(request, DASHBOARD_OVERVIEW_PATH, supabaseResponse);
    }
  }

  if (user && !isVerified) {
    if (
      pathname === LOGIN_PATH ||
      pathname === "/signup" ||
      pathname === "/forgot-password" ||
      isVerifyResetOtp
    ) {
      return redirectTo(request, VERIFY_EMAIL_PATH, supabaseResponse);
    }
  }

  if (!user && isVerifyEmail) {
    // Allow anonymous OTP entry when redirected with ?email= after an
    // unverified login (Supabase may refuse a session until confirmed).
    return supabaseResponse;
  }

  // Password reset requires a short-lived OTP authorization cookie, not a
  // recovery magic-link session.
  if (isResetPassword && !hasPasswordResetCookie) {
    return redirectTo(request, "/forgot-password", supabaseResponse);
  }

  if (isAuthPage) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, max-age=0, must-revalidate",
    );
  }

  return supabaseResponse;
}
