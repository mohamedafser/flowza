import { Suspense } from "react";
import { AdminSubscriptionsScreen } from "@/components/admin/AdminSubscriptionsScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminSubscriptionsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminSubscriptionsScreen />
    </Suspense>
  );
}
