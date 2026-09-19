import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

/**
 * Root fallback for routes outside the app shell.
 * Never paints a fake sidebar/header — those come from AppShell only.
 */
export default function Loading() {
  return (
    <div className="bg-muted/30 min-h-dvh">
      <PageContainer className="py-8">
        <DashboardPageSkeleton />
      </PageContainer>
    </div>
  );
}
