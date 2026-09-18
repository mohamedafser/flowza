"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";
import { PageContainer } from "@/components/layout/PageContainer";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Application error:", error.digest ?? error.name);
  }, [error]);

  return (
    <PageContainer className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        title="We hit an unexpected problem"
        message="Please try again. Live queue information was not shown from cache."
        onRetry={reset}
        className="w-full max-w-md"
      />
    </PageContainer>
  );
}
