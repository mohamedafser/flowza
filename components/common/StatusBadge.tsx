import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types";

const toneClass: Record<StatusTone, string> = {
  default: "",
  success:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  warning:
    "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  danger:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  info: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusBadge({
  label,
  tone = "default",
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant={tone === "default" ? "secondary" : "outline"}
      className={cn(toneClass[tone], className)}
    >
      {label}
    </Badge>
  );
}
