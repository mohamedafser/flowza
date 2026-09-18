import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";

export default function NotFound() {
  return (
    <PageContainer className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        className="w-full max-w-md"
        title="Page not found"
        description="The page you requested does not exist or may have moved."
        action={<Button render={<Link href="/" />}>Back to home</Button>}
      />
    </PageContainer>
  );
}
