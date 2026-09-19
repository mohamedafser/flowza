import { AuthFormSkeleton } from "@/components/common/PageSkeletons";

export default function AuthLoading() {
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <AuthFormSkeleton />
    </div>
  );
}
