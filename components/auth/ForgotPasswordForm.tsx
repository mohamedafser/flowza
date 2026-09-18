"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to send reset email.");
        return;
      }
      setSent(true);
      toast.success(result.message);
    });
  });

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="If an account exists for this email, you'll receive a password reset link."
        footer={
          <>
            Remembered it? <AuthLink href="/login">Log in</AuthLink>
          </>
        }
      >
        <p className="text-muted-foreground text-sm">
          The link expires after a short time. You can request another reset if
          needed.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password"
      description="Enter your email and we'll send a reset link if an account exists."
      footer={
        <>
          Back to <AuthLink href="/login">log in</AuthLink>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            disabled={pending}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
