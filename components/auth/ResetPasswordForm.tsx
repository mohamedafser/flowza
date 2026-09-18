"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { resetPasswordAction } from "@/app/actions/auth";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LOGIN_PATH } from "@/lib/auth/paths";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to update password.");
        return;
      }
      setDone(true);
      toast.success(result.message);
      router.replace(LOGIN_PATH);
      router.refresh();
    });
  });

  if (done) {
    return (
      <AuthCard
        title="Password updated"
        description="You can sign in with your new password."
        footer={
          <>
            Continue to <AuthLink href="/login">log in</AuthLink>
          </>
        }
      >
        <p className="text-muted-foreground text-sm">
          Your previous sessions have been cleared for security.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password for your account."
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            disabled={pending}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            disabled={pending}
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}
