import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/common/PageSkeletons";

export default function SettingsMembersLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading staff"
    >
      <PageHeaderSkeleton withActions />
      <TableSkeleton rows={4} cols={3} />
    </div>
  );
}
