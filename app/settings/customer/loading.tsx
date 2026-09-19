import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/common/PageSkeletons";

export default function SettingsSectionLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading settings"
    >
      <PageHeaderSkeleton />
      <FormSkeleton fields={6} />
    </div>
  );
}
