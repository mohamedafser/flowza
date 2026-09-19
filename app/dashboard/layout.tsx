import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";
import { requireWorkspacePage } from "@/lib/context/workspace";

export const dynamic = "force-dynamic";

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspacePage();
  return (
    <AppShell title="Dashboard" workspace={workspace}>
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <AppShell title="Dashboard" workspace={null}>
          <DashboardPageSkeleton />
        </AppShell>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
