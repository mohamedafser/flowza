import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/common/PageSkeletons";

export default function NewCustomerLoading() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading new customer form"
    >
      <PageHeaderSkeleton />
      <FormSkeleton fields={5} />
    </div>
  );
}
