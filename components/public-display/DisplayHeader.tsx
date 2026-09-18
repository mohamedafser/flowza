"use client";

import type { PublicDisplayData } from "@/lib/public-display/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { queueStatusTone } from "@/lib/utils/queue";
import { cn } from "@/lib/utils";

type DisplayHeaderProps = {
  data: PublicDisplayData;
};

export function DisplayHeader({ data }: DisplayHeaderProps) {
  const { settings, restaurant, branch, queue } = data;
  const showLogo = settings.showRestaurantLogo && restaurant.logoUrl;

  return (
    <header className="border-border/60 flex items-start justify-between gap-4 border-b px-6 py-5 sm:px-10 lg:px-16 xl:px-24">
      <div className="flex min-w-0 items-center gap-4">
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logoUrl!}
            alt=""
            className="size-12 rounded-lg object-cover sm:size-16"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            {restaurant.name}
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-base lg:text-lg">
            {settings.showBranchName ? <span>{branch.name}</span> : null}
            {settings.showBranchName && settings.showQueueName ? (
              <span aria-hidden>·</span>
            ) : null}
            {settings.showQueueName ? <span>{queue.name}</span> : null}
          </div>
        </div>
      </div>
      <StatusBadge
        label={queue.statusLabel}
        tone={queueStatusTone(queue.status)}
        className={cn("shrink-0 px-3 py-1 text-sm sm:text-base")}
      />
    </header>
  );
}
