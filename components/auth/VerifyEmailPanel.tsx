"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { resendVerificationAction, signOutAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";

type VerifyEmailPanelProps = {
  email: string;
  verified: boolean;
  linkError?: boolean;
};

export function VerifyEmailPanel({
  email,
  verified,
  linkError = false,
}: VerifyEmailPanelProps) {
  const [pending, startTransition] = useTransition();
  const [signingOut, startSignOut] = useTransition();

  const onResend = () => {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (!result.ok) {
        toast.error(result.message ?? "Unable to resend email.");
        return;
      }
      toast.success(result.message ?? "Verification email sent.");
    });
  };

  const onSignOut = () => {
    startSignOut(async () => {
      await signOutAction();
    });
  };

  return (
    <AuthCard
      title="Verify your email"
      description="Confirm your email address before accessing the dashboard."
    >
      <div className="space-y-4">
        {linkError ? (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            This verification link is invalid or has expired. Request a new
            email below.
          </p>
        ) : null}

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Email</p>
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
          <Button
            type="button"
            className="w-full"
            disabled={pending || signingOut}
            onClick={onResend}
          >
            {pending ? "Sending…" : "Resend verification email"}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending || signingOut}
          onClick={onSignOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </AuthCard>
  );
}
