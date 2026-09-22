import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthFormSkeleton } from "@/components/common/PageSkeletons";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignupForm />
    </Suspense>
  );
}
