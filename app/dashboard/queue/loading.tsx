import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { QUEUE_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";

export default function QueueLoading() {
  return (
    <div>
      <PageHeader
        title="Queue Management"
        description="Call, seat, and complete waiting guests for this branch."
        breadcrumbs={QUEUE_BREADCRUMBS}
      />
      <LoadingState label="Loading queue…" rows={6} />
    </div>
  );
}
