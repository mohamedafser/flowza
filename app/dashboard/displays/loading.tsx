import { BoardSkeleton } from "@/components/common/PageSkeletons";

export default function DisplaysLoading() {
  return <BoardSkeleton label="Loading displays…" withFilters={false} />;
}
