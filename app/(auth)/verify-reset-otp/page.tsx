import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyResetOtpPanel } from "@/components/auth/VerifyResetOtpPanel";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/paths";
import { emailSchema } from "@/lib/validations/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getOtpStatus } from "@/services/auth/otp";

export const metadata: Metadata = {
  title: "Verify reset code",
};

export const dynamic = "force-dynamic";

type VerifyResetOtpPageProps = {
  searchParams: Promise<{
    email?: string;
    expiresAt?: string;
    resendAvailableAt?: string;
  }>;
};

export default async function VerifyResetOtpPage({
  searchParams,
}: VerifyResetOtpPageProps) {
  if (!isSupabaseConfigured()) {
    redirect(LOGIN_PATH);
  }

  const params = await searchParams;
  const parsedEmail = emailSchema.safeParse(params.email ?? "");
  if (!parsedEmail.success) {
    redirect(FORGOT_PASSWORD_PATH);
  }

  const email = parsedEmail.data.toLowerCase();
  const status = await getOtpStatus({
    email,
    purpose: "PASSWORD_RESET",
  });

  return (
    <VerifyResetOtpPanel
      email={email}
      expiresAt={params.expiresAt ?? status.expiresAt}
      resendAvailableAt={params.resendAvailableAt ?? status.resendAvailableAt}
    />
  );
}
