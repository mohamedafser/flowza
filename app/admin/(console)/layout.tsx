import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";
import { requireAdminPage } from "@/lib/auth/platform-guards";

export const dynamic = "force-dynamic";

async function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const auth = await requireAdminPage();
  return (
    <AdminShell
      userEmail={auth.user.email}
      userName={auth.profile.full_name}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <AdminShell>
          <DashboardPageSkeleton />
        </AdminShell>
      }
    >
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}
