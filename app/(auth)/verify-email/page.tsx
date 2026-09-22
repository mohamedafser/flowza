import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import {
  isEmailVerified,
  resolvePostAuthDestination,
} from "@/lib/auth/session";
import { getOtpStatus } from "@/services/auth/otp";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { emailSchema } from "@/lib/validations/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Verify email",
};

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  if (!isSupabaseConfigured()) {
    redirect(LOGIN_PATH);
  }

  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const verified = isEmailVerified(user);
    if (verified) {
      redirect(await resolvePostAuthDestination(user));
    }

    const email = user.email ?? "Unknown";
    const status =
      user.email != null
        ? await getOtpStatus({ email: user.email, purpose: "SIGNUP" })
        : {
            hasActive: false,
            expiresAt: null,
            resendAvailableAt: null,
            locked: false,
          };

    return (
      <VerifyEmailPanel
        email={email}
        verified={false}
        expiresAt={status.expiresAt}
        resendAvailableAt={status.resendAvailableAt}
      />
    );
  }

  // No session — allow verify via ?email= after login was blocked for confirmations.
  const parsedEmail = emailSchema.safeParse(params.email ?? "");
  if (!parsedEmail.success) {
    redirect(LOGIN_PATH);
  }

  const email = parsedEmail.data.toLowerCase();
  const status = await getOtpStatus({ email, purpose: "SIGNUP" });

  return (
    <VerifyEmailPanel
      email={email}
      verified={false}
      expiresAt={status.expiresAt}
      resendAvailableAt={status.resendAvailableAt}
      requiresEmailParam
    />
  );
}
