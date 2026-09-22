"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, KeyRound } from "lucide-react";
import { forgotPasswordRequest } from "@/lib/api/auth-client";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VERIFY_RESET_OTP_PATH } from "@/lib/auth/paths";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (pending) return;
    startTransition(async () => {
      const result = await forgotPasswordRequest(values);
      if (!result.ok && result.code !== "RATE_LIMITED") {
        toast.error(result.message ?? "Unable to send reset code.");
        return;
      }
      if (result.code === "RATE_LIMITED") {
        toast.error(result.message);
      } else {
        toast.success(result.message);
      }
      router.replace(
        result.data?.redirectTo ??
          `${VERIFY_RESET_OTP_PATH}?email=${encodeURIComponent(values.email.trim().toLowerCase())}`,
      );
      router.refresh();
    });
  });

  return (
    <AuthCard
      title="Forgot password"
      description="Enter your email and we'll send a 6-digit reset code if an account exists."
      icon={KeyRound}
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
        <Button type="submit" className="auth-submit w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset code"}
          {pending ? null : <ArrowRight className="size-4" />}
        </Button>
      </form>
    </AuthCard>
  );
}
