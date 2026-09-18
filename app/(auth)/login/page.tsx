import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Log in" description="Loading…">
          <div className="bg-muted h-40 animate-pulse rounded-lg" />
        </AuthCard>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
