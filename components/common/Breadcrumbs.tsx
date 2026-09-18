import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3", className)}>
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 opacity-60"
                  aria-hidden
                />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground truncate transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    isLast ? "text-foreground font-medium" : undefined,
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
