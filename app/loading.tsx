import { LoadingState } from "@/components/common/LoadingState";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <PageContainer>
      <LoadingState label="Loading Flowza…" rows={5} />
    </PageContainer>
  );
}
