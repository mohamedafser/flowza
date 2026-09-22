import { Suspense } from "react";
import { AdminRestaurantsScreen } from "@/components/admin/AdminRestaurantsScreen";
import { DashboardPageSkeleton } from "@/components/common/PageSkeletons";

export default function AdminRestaurantsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminRestaurantsScreen />
    </Suspense>
  );
}
