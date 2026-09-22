"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, MailCheck } from "lucide-react";
import {
  resendOtpRequest,
  signOutRequest,
  verifyOtpRequest,
} from "@/lib/api/auth-client";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  OtpInput,
  useOtpCountdown,
  useResendCooldown,
} from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LOGIN_PATH } from "@/lib/auth/paths";

type VerifyEmailPanelProps = {
  email: string;
  verified: boolean;
  expiresAt?: string | null;
  resendAvailableAt?: string | null;
  /** True when the user has no session yet (login blocked until verify). */
  requiresEmailParam?: boolean;
};

export function VerifyEmailPanel({
  email,
  verified,
  expiresAt: initialExpiresAt = null,
  resendAvailableAt: initialResendAt = null,
  requiresEmailParam = false,
}: VerifyEmailPanelProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(
    initialResendAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const countdown = useOtpCountdown(expiresAt);
  const resend = useResendCooldown(resendAvailableAt);

  const onVerify = () => {
    if (pending || code.length !== 6) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyOtpRequest({
        email,
        code,
        purpose: "SIGNUP",
      });
      if (!result.ok) {
        setError(result.message ?? "Unable to verify code.");
        toast.error(result.message ?? "Unable to verify code.");
        return;
      }
      toast.success(result.message ?? "Email verified.");
      router.replace(result.data?.redirectTo ?? "/dashboard/overview");
      router.refresh();
    });
  };

  const onResend = () => {
    if (pending || !resend.ready) return;
    setError(null);
    startTransition(async () => {
      const result = await resendOtpRequest({
        purpose: "SIGNUP",
        email: requiresEmailParam ? email : undefined,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Unable to resend code.");
        return;
      }
      if (result.data?.expiresAt) setExpiresAt(result.data.expiresAt);
      if (result.data?.resendAvailableAt) {
        setResendAvailableAt(result.data.resendAvailableAt);
      }
      setCode("");
      toast.success(result.message ?? "Verification code sent.");
    });
  };

  const onSignOut = () => {
    startSignOut(async () => {
      await signOutRequest();
      router.replace(LOGIN_PATH);
      router.refresh();
    });
  };

  return (
    <AuthCard
      title="Verify your email"
      description="Enter the 6-digit code we sent to your inbox."
      icon={MailCheck}
    >
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">We sent a code to</p>
          <p className="font-medium break-all">{email}</p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status</span>
          <StatusBadge
            tone={verified ? "success" : "warning"}
            label={verified ? "Verified" : "Unverified"}
          />
        </div>

        {!verified ? (
          <>
            <OtpInput
              value={code}
              onChange={setCode}
              disabled={pending || signingOut}
              aria-invalid={Boolean(error)}
            />

            {expiresAt ? (
              <p className="text-muted-foreground text-center text-sm">
                {countdown.expired
                  ? "Code expired — request a new one."
                  : `Code expires in ${countdown.label}`}
              </p>
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                Request a code if you have not received one yet.
              </p>
            )}

            {error ? (
              <p className="text-destructive text-center text-sm">{error}</p>
            ) : null}

            <Button
              type="button"
              className="auth-submit w-full"
              disabled={pending || signingOut || code.length !== 6}
              onClick={onVerify}
            >
              {pending ? "Verifying…" : "Verify"}
              {pending ? null : <ArrowRight className="size-4" />}
            </Button>

            <div className="text-center text-sm">
              <p className="text-muted-foreground mb-2">
                Didn&apos;t receive the code?
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending || signingOut || !resend.ready}
                onClick={onResend}
              >
                {!resend.ready
                  ? `Resend in ${resend.remainingSeconds}s`
                  : pending
                    ? "Sending…"
                    : "Resend OTP"}
              </Button>
            </div>
          </>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending || signingOut}
          onClick={onSignOut}
        >
          {signingOut
            ? "Signing out…"
            : requiresEmailParam
              ? "Back to log in"
              : "Sign out"}
        </Button>
      </div>
    </AuthCard>
  );
}
