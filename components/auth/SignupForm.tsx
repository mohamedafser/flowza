"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { signUpAction } from "@/app/actions/auth";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VERIFY_EMAIL_PATH } from "@/lib/auth/paths";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export function SignupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await signUpAction(values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to create account.");
        return;
      }
      setSubmittedEmail(values.email);
      toast.success("Check your email to verify your account.");
      router.refresh();
      if (result.hasSession) {
        router.replace(VERIFY_EMAIL_PATH);
      }
    });
  });

  if (submittedEmail) {
    return (
      <AuthCard
        title="Verify your email"
        description="We sent a verification link to your inbox."
        footer={
          <>
            Already verified? <AuthLink href="/login">Log in</AuthLink>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            Email:{" "}
            <span className="text-foreground font-medium">
              {submittedEmail}
            </span>
          </p>
          <p className="text-muted-foreground">
            Open the link in the email to activate your account. You can close
            this tab after verifying.
          </p>
          <Button
            className="w-full"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Back to log in
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start with your personal account. Restaurant setup comes next."
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
            disabled={pending}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.email.message}
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

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </AuthCard>
  );
}
