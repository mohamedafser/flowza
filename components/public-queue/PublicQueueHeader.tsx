import Image from "next/image";
import type {
  PublicQueueBrand,
  PublicQueueBranch,
} from "@/lib/public-queue/types";
import { cn } from "@/lib/utils";

type PublicQueueHeaderProps = {
  restaurant: PublicQueueBrand;
  branch: PublicQueueBranch;
  className?: string;
};

export function PublicQueueHeader({
  restaurant,
  branch,
  className,
}: PublicQueueHeaderProps) {
  return (
    <header
      className={cn("flex items-start justify-between gap-3 pb-4", className)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="border-border bg-muted/40 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
          {restaurant.logoUrl ? (
            <Image
              src={restaurant.logoUrl}
              alt=""
              width={56}
              height={56}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-lg font-semibold uppercase">
              {restaurant.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight">
            {restaurant.name}
          </p>
          <p className="text-muted-foreground truncate text-sm">
            {branch.name}
          </p>
          {branch.address ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
              {branch.address}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
