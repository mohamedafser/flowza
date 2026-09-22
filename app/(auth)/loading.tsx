import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormSkeleton } from "@/components/common/PageSkeletons";

export default function AuthLoading() {
  return (
    <AuthShell>
      <AuthFormSkeleton />
    </AuthShell>
  );
}
