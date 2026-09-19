import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/common/PageSkeletons";

export default function BranchesLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading branches"
    >
      <PageHeaderSkeleton withActions />
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
