import { Skeleton } from "@/components/ui/skeleton";
import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/common/PageSkeletons";

export default function CustomerDetailLoading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading customer">
      <PageHeaderSkeleton withActions />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <FormSkeleton fields={6} />
        <div className="border-border bg-card space-y-3 rounded-xl border p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}
