"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BranchListQuery } from "@/lib/validations/branch";

type BranchListFiltersProps = {
  search: string;
  status: BranchListQuery["status"];
  pending?: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: BranchListQuery["status"]) => void;
};

export function BranchListFilters({
  search,
  status,
  pending = false,
  onSearchChange,
  onStatusChange,
}: BranchListFiltersProps) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative w-full max-w-sm flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search branches…"
          className="pl-8"
          aria-label="Search branches"
          disabled={pending}
        />
      </div>

      <Select
        value={status}
        aria-label="Filter by status"
        className="w-full sm:w-40"
        disabled={pending}
        onChange={(event) => {
          onStatusChange(event.target.value as BranchListQuery["status"]);
        }}
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </Select>
    </div>
  );
}
