"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import { switchBranchRequest } from "@/lib/api/restaurants-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Branch } from "@/lib/context/restaurant";
import { cn } from "@/lib/utils";

type BranchSwitcherProps = {
  branches: Branch[];
  currentBranchId: string | null;
  className?: string;
};

export function BranchSwitcher({
  branches,
  currentBranchId,
  className,
}: BranchSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // `branches` is already active-only from the server (Postgres filter).
  const current =
    branches.find((branch) => branch.id === currentBranchId) ??
    branches[0] ??
    null;

  if (branches.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex",
          className,
        )}
      >
        <MapPin className="size-3.5" />
        <span>No active branches</span>
      </div>
    );
  }

  const onSelect = (branchId: string) => {
    if (branchId === current?.id) return;
    startTransition(async () => {
      const result = await switchBranchRequest(branchId);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to switch branch.");
        return;
      }
      router.refresh();
    });
  };

  if (branches.length === 1 && current) {
    return (
      <div
        className={cn(
          "hidden min-w-0 items-center gap-1.5 text-sm sm:flex",
          className,
        )}
      >
        <MapPin className="text-muted-foreground size-3.5 shrink-0" />
        <span className="truncate">{current.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className={cn(
              "hidden max-w-[12rem] justify-between gap-2 sm:inline-flex",
              className,
            )}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0 opacity-60" />
          <span className="truncate">{current?.name ?? "Select branch"}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Active branches</DropdownMenuLabel>
          {branches.map((branch) => {
            const selected = branch.id === current?.id;
            return (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => onSelect(branch.id)}
                className="gap-2"
              >
                <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                {selected ? <Check className="size-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
