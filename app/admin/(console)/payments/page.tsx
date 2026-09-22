import { Suspense } from "react";
import { AdminPaymentsScreen } from "@/components/admin/AdminPaymentsScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminPaymentsScreen />
    </Suspense>
  );
}
