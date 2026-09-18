"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { publicQueueStatusPath } from "@/lib/public-queue/paths";
import { readPublicQueueSession } from "@/lib/public-queue/session";

type ResumeQueueStatusProps = {
  restaurantSlug: string;
  branchSlug: string;
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function ResumeQueueStatus({
  restaurantSlug,
  branchSlug,
}: ResumeQueueStatusProps) {
  const href = useSyncExternalStore(
    subscribe,
    () => {
      const saved = readPublicQueueSession(restaurantSlug, branchSlug);
      if (!saved) return null;
      return publicQueueStatusPath(
        saved.restaurantSlug,
        saved.branchSlug,
        saved.accessToken,
      );
    },
    () => null,
  );

  if (!href) return null;

  return (
    <Button
      variant="outline"
      size="lg"
      className="h-12 w-full text-base"
      render={<Link href={href} />}
      nativeButton={false}
    >
      View your place in line
    </Button>
  );
}
