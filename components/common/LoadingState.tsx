import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  className?: string;
  rows?: number;
};

export function LoadingState({
  label = "Loading…",
  className,
  rows = 3,
}: LoadingStateProps) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
