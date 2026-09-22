import { Suspense } from "react";
import { AdminSettingsScreen } from "@/components/admin/AdminSettingsScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminSettingsScreen />
    </Suspense>
  );
}
