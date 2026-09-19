import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
  rows?: number;
  /** @deprecated Prefer PageSkeletons for structured layouts. */
  variant?: "rows" | "cards";
};

/**
 * Lightweight generic skeleton list.
 * Prefer route-specific skeletons from `@/components/common/PageSkeletons`.
 */
export function LoadingState({
  label = "Loading…",
  className,
  rows = 3,
  variant = "rows",
}: LoadingStateProps) {
  if (variant === "cards") {
    return (
      <div
        className={cn("grid gap-3 sm:grid-cols-2", className)}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-card space-y-2 rounded-xl border p-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-10 w-full rounded-lg",
            index % 3 === 0 && "w-[92%]",
            index % 3 === 1 && "w-full",
            index % 3 === 2 && "w-[85%]",
          )}
        />
      ))}
    </div>
  );
}
