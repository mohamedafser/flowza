import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon,
  className,
  selected = false,
  onClick,
  "aria-label": ariaLabel,
}: StatCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        className,
        interactive &&
          "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/50 cursor-pointer transition-colors focus-visible:ring-3",
        selected && "bg-muted/60 ring-primary ring-2",
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      aria-pressed={interactive ? selected : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        {icon ? (
          <div className="text-muted-foreground [&_svg]:size-4">{icon}</div>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
