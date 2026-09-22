"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, LogIn } from "lucide-react";
import { signInRequest } from "@/lib/api/auth-client";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DASHBOARD_OVERVIEW_PATH,
  VERIFY_EMAIL_PATH,
  safeRedirectPath,
} from "@/lib/auth/paths";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (searchParams.get("error") === "link_invalid") {
      toast.error("This link is invalid or has expired. Please try again.");
    }
    if (searchParams.get("verified") === "1") {
      toast.success("Email verified. You can sign in now.");
    }
  }, [searchParams]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (pending) return;
    startTransition(async () => {
      const result = await signInRequest(values);
      if (!result.ok) {
        if (result.code === "UNVERIFIED") {
          const target =
            result.data?.redirectTo ??
            `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(values.email.trim().toLowerCase())}`;
          router.replace(target);
          router.refresh();
          return;
        }
        toast.error(result.message ?? "Unable to sign in.");
        return;
      }

      const next = safeRedirectPath(
        searchParams.get("next"),
        result.data?.redirectTo ?? DASHBOARD_OVERVIEW_PATH,
      );
      const destination =
        result.data?.redirectTo?.includes("/onboarding") &&
        !next.startsWith("/onboarding")
          ? result.data.redirectTo
          : next;
      router.replace(destination);
      router.refresh();
    });
  });

  return (
    <AuthCard
      title="Log in"
      description="Sign in to manage your restaurant queue."
      icon={LogIn}
      footer={
        <>
          No account yet? <AuthLink href="/signup">Sign up</AuthLink>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">Password</Label>
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
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

        <Button type="submit" className="auth-submit w-full" disabled={pending}>
          {pending ? "Signing in…" : "Log in"}
          {pending ? null : <ArrowRight className="size-4" />}
        </Button>
      </form>
    </AuthCard>
  );
}
