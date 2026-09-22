import { Suspense } from "react";
import { AdminPlansScreen } from "@/components/admin/AdminPlansScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminPlansPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminPlansScreen />
    </Suspense>
  );
}
