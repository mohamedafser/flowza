import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/common/PageSkeletons";

export default function SettingsTablesLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading table settings"
    >
      <PageHeaderSkeleton />
      <FormSkeleton fields={4} />
    </div>
  );
}
