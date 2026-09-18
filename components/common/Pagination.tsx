"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  /** Link-based navigation (RSC pages). Prefer onPageChange for JSON APIs. */
  buildHref?: (page: number) => string;
  buildPageSizeHref?: (pageSize: number) => string;
  /** Client callback navigation (JSON list APIs). */
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  siblingCount?: number;
};

/**
 * Build a compact page list with ellipsis markers.
 * Example (page 5, total 12): [1, "ellipsis", 4, 5, 6, "ellipsis", 12]
 */
export function getPaginationItems(
  current: number,
  totalPages: number,
  siblingCount = 1,
): Array<number | "ellipsis"> {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }

  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + 1 + i,
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", totalPages];
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  buildHref,
  buildPageSizeHref,
  onPageChange,
  onPageSizeChange,
  className,
  siblingCount = 1,
}: PaginationProps) {
  if (total <= 0) {
    return null;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const items =
    totalPages > 1 ? getPaginationItems(page, totalPages, siblingCount) : [1];
  const useCallbacks = Boolean(onPageChange);
  const showRows = Boolean(onPageSizeChange || buildPageSizeHref);

  const goToPage = (nextPage: number) => {
    if (onPageChange) {
      onPageChange(nextPage);
      return;
    }
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "border-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
        <p className="tabular-nums">
          <span className="text-foreground">
            {from}–{to}
          </span>{" "}
          of <span className="text-foreground">{total}</span>
        </p>

        {showRows ? (
          <label className="flex items-center gap-2">
            <span>Rows</span>
            <Select
              aria-label="Rows per page"
              className="h-8 w-18"
              value={String(pageSize)}
              onChange={(event) => {
                const nextSize = Number(event.target.value);
                if (!Number.isFinite(nextSize) || nextSize === pageSize) {
                  return;
                }
                if (onPageSizeChange) {
                  onPageSizeChange(nextSize);
                  return;
                }
                if (buildPageSizeHref) {
                  window.location.assign(buildPageSizeHref(nextSize));
                }
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {useCallbacks ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            aria-label="Previous page"
            className="gap-1 px-2.5"
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev || !buildHref}
            aria-label="Previous page"
            render={
              hasPrev && buildHref ? (
                <Link href={buildHref(page - 1)} />
              ) : undefined
            }
            nativeButton={!hasPrev || !buildHref}
            className="gap-1 px-2.5"
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
        )}

        {items.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="text-muted-foreground px-1 text-sm"
                aria-hidden
              >
                …
              </span>
            );
          }

          const isCurrent = item === page;
          if (useCallbacks) {
            return (
              <Button
                key={item}
                variant={isCurrent ? "default" : "outline"}
                size="sm"
                aria-label={`Page ${item}`}
                aria-current={isCurrent ? "page" : undefined}
                disabled={isCurrent}
                className="min-w-8 px-2 tabular-nums"
                onClick={() => goToPage(item)}
              >
                {item}
              </Button>
            );
          }

          return (
            <Button
              key={item}
              variant={isCurrent ? "default" : "outline"}
              size="sm"
              aria-label={`Page ${item}`}
              aria-current={isCurrent ? "page" : undefined}
              render={
                !isCurrent && buildHref ? (
                  <Link href={buildHref(item)} />
                ) : undefined
              }
              nativeButton={isCurrent || !buildHref}
              className="min-w-8 px-2 tabular-nums"
            >
              {item}
            </Button>
          );
        })}

        {useCallbacks ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            aria-label="Next page"
            className="gap-1 px-2.5"
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || !buildHref}
            aria-label="Next page"
            render={
              hasNext && buildHref ? (
                <Link href={buildHref(page + 1)} />
              ) : undefined
            }
            nativeButton={!hasNext || !buildHref}
            className="gap-1 px-2.5"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </nav>
  );
}
