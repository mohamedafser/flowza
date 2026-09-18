import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import {
  isEmailVerified,
  resolvePostAuthDestination,
} from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Verify email",
};

export const dynamic = "force-dynamic";

type VerifyEmailPageProps = {
  searchParams: Promise<{ error?: string }>;
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

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const verified = isEmailVerified(user);
  if (verified) {
    redirect(await resolvePostAuthDestination(user));
  }

  return (
    <VerifyEmailPanel
      email={user.email ?? "Unknown"}
      verified={verified}
      linkError={params.error === "link_invalid"}
    />
  );
}
