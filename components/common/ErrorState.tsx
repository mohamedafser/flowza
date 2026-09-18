import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again. If the problem continues, contact support.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-card flex flex-col items-center justify-center rounded-xl border px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="text-destructive mb-3 size-8" />
      <h2 className="text-base font-medium">{title}</h2>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
      {onRetry ? (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
