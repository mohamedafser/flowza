import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormSkeleton } from "@/components/common/PageSkeletons";

/**
 * Root fallback for routes outside the app shell.
 * Landing → login/signup shares this boundary, so mirror the auth screen
 * instead of painting a dashboard skeleton.
 */
export default function Loading() {
  return (
    <AuthShell>
      <AuthFormSkeleton />
    </AuthShell>
  );
}
