import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-muted/20 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground mb-3">
        {icon ?? <Inbox className="size-8" />}
      </div>
      <h2 className="text-base font-medium">{title}</h2>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
