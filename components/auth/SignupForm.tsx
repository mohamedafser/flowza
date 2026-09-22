"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, UserPlus } from "lucide-react";
import { signUpRequest } from "@/lib/api/auth-client";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VERIFY_EMAIL_PATH } from "@/lib/auth/paths";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const prefillEmail = searchParams.get("email")?.trim() ?? "";
  const invitationId = searchParams.get("invite")?.trim() || undefined;

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: prefillEmail,
      password: "",
      confirmPassword: "",
      invitationId,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (pending) return;
    startTransition(async () => {
      const result = await signUpRequest(values);
      if (!result.ok) {
        if (result.data?.redirectTo?.includes("/verify-email")) {
          toast.success(
            result.message ?? "Enter the verification code we emailed you.",
          );
          router.replace(result.data.redirectTo);
          router.refresh();
          return;
        }
        toast.error(result.message ?? "Unable to create account.");
        if (result.data?.redirectTo?.includes("/login")) {
          router.replace(result.data.redirectTo);
        }
        return;
      }
      toast.success(
        result.message ?? "Account created. Enter the code we emailed you.",
      );
      router.replace(result.data?.redirectTo ?? VERIFY_EMAIL_PATH);
      router.refresh();
    });
  });

  return (
    <AuthCard
      title="Create your account"
      description={
        invitationId
          ? "Accept your invitation by creating an account with the invited email."
          : "Start with your personal account. Restaurant setup comes next."
      }
      icon={UserPlus}
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Alex Rivera"
            aria-invalid={Boolean(form.formState.errors.fullName)}
            disabled={pending}
            {...form.register("fullName")}
          />
          {form.formState.errors.fullName ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.fullName.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            disabled={pending || Boolean(prefillEmail && invitationId)}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.email.message}
            </p>
          ) : null}
          {invitationId ? (
            <p className="text-muted-foreground text-xs">
              Use the invited email address so your membership can be activated.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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
          <p className="text-muted-foreground text-xs">
            At least 8 characters, including a letter and a number.
          </p>
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

        <Button type="submit" className="auth-submit w-full" disabled={pending}>
          {pending ? "Creating account…" : "Sign up"}
          {pending ? null : <ArrowRight className="size-4" />}
        </Button>
      </form>
    </AuthCard>
  );
}
