import {
  Breadcrumbs,
  type BreadcrumbItem,
} from "@/components/common/Breadcrumbs";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumbs items={breadcrumbs} />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
