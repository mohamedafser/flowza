import { Suspense } from "react";
import { AdminAuditLogsScreen } from "@/components/admin/AdminAuditLogsScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminAuditLogsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminAuditLogsScreen />
    </Suspense>
  );
}
