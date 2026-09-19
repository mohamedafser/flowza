import { BoardSkeleton } from "@/components/common/PageSkeletons";

export default function QrCodesLoading() {
  return <BoardSkeleton label="Loading QR codes…" withFilters={false} />;
}
