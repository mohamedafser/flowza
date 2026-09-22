import { Suspense } from "react";
import { AdminUsersScreen } from "@/components/admin/AdminUsersScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminUsersScreen />
    </Suspense>
  );
}
