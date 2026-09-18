import { cn } from "@/lib/utils";

type AlertProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "warning" | "destructive";
  title?: string;
};

const variantClass = {
  default: "border-border bg-muted/40 text-foreground",
  warning:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function Alert({
  children,
  className,
  variant = "default",
  title,
}: AlertProps) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-3 py-2.5 text-sm",
        variantClass[variant],
        className,
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "text-muted-foreground mt-1" : undefined}>
        {children}
      </div>
    </div>
  );
}
