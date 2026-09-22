"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { resendOtpRequest, verifyOtpRequest } from "@/lib/api/auth-client";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import {
  OtpInput,
  useOtpCountdown,
  useResendCooldown,
} from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/button";
import { RESET_PASSWORD_PATH } from "@/lib/auth/paths";

type VerifyResetOtpPanelProps = {
  email: string;
  expiresAt?: string | null;
  resendAvailableAt?: string | null;
};

export function VerifyResetOtpPanel({
  email,
  expiresAt: initialExpiresAt = null,
  resendAvailableAt: initialResendAt = null,
}: VerifyResetOtpPanelProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(
    initialResendAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const countdown = useOtpCountdown(expiresAt);
  const resend = useResendCooldown(resendAvailableAt);

  const onVerify = () => {
    if (pending || code.length !== 6) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyOtpRequest({
        email,
        code,
        purpose: "PASSWORD_RESET",
      });
      if (!result.ok) {
        setError(result.message ?? "Unable to verify code.");
        toast.error(result.message ?? "Unable to verify code.");
        return;
      }
      toast.success(result.message ?? "Code verified.");
      router.replace(result.data?.redirectTo ?? RESET_PASSWORD_PATH);
      router.refresh();
    });
  };

  const onResend = () => {
    if (pending || !resend.ready) return;
    setError(null);
    startTransition(async () => {
      const result = await resendOtpRequest({
        email,
        purpose: "PASSWORD_RESET",
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

  return (
    <AuthCard
      title="Enter reset code"
      description="We sent a 6-digit code to reset your password."
      icon={ShieldCheck}
      footer={
        <>
          Back to <AuthLink href="/forgot-password">forgot password</AuthLink>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Code sent to</p>
          <p className="font-medium break-all">{email}</p>
        </div>

        <OtpInput
          value={code}
          onChange={setCode}
          disabled={pending}
          aria-invalid={Boolean(error)}
        />

        {expiresAt ? (
          <p className="text-muted-foreground text-center text-sm">
            {countdown.expired
              ? "Code expired — request a new one."
              : `Code expires in ${countdown.label}`}
          </p>
        ) : null}

        {error ? (
          <p className="text-destructive text-center text-sm">{error}</p>
        ) : null}

        <Button
          type="button"
          className="auth-submit w-full"
          disabled={pending || code.length !== 6}
          onClick={onVerify}
        >
          {pending ? "Verifying…" : "Verify code"}
          {pending ? null : <ArrowRight className="size-4" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending || !resend.ready}
          onClick={onResend}
        >
          {!resend.ready
            ? `Resend in ${resend.remainingSeconds}s`
            : pending
              ? "Sending…"
              : "Resend OTP"}
        </Button>
      </div>
    </AuthCard>
  );
}
