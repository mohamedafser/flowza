"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  tableStatusLabel,
  tableStatusTone,
} from "@/lib/utils/tables";
import type { TableStatus } from "@/lib/validations/table";

export type TablePickerOption = {
  id: string;
  label: string;
  capacity: number;
  status: string;
};

type TableStatusPickerProps = {
  tables: TablePickerOption[];
  value: string;
  onChange: (tableId: string) => void;
  disabled?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  className?: string;
};

const STATUS_ORDER: Record<string, number> = {
  AVAILABLE: 0,
  RESERVED: 1,
  CLEANING: 2,
  OCCUPIED: 3,
  BLOCKED: 4,
};

function isTableStatus(value: string): value is TableStatus {
  return (
    value === "AVAILABLE" ||
    value === "OCCUPIED" ||
    value === "CLEANING" ||
    value === "RESERVED" ||
    value === "BLOCKED"
  );
}

function sortTables(tables: TablePickerOption[]): TablePickerOption[] {
  return [...tables].sort((a, b) => {
    const statusDelta =
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}

export function TableStatusPicker({
  tables,
  value,
  onChange,
  disabled = false,
  allowNone = false,
  noneLabel = "No preference",
  placeholder = "Select a table",
  className,
}: TableStatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const selected = tables.find((table) => table.id === value) ?? null;
  const selectedStatus =
    selected && isTableStatus(selected.status) ? selected.status : null;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return sortTables(tables).filter((table) => {
      if (availableOnly && table.status !== "AVAILABLE") return false;
      if (!trimmed) return true;
      return (
        table.label.toLowerCase().includes(trimmed) ||
        String(table.capacity).includes(trimmed) ||
        table.status.toLowerCase().includes(trimmed)
      );
    });
  }, [tables, query, availableOnly]);

  function pick(tableId: string) {
    onChange(tableId);
    setOpen(false);
    setQuery("");
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-expanded={open}
            className={cn(
              "h-auto min-h-9 w-full justify-between gap-2 px-2.5 py-1.5 font-normal",
              className,
            )}
          />
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selected ? (
            <>
              <span className="min-w-0 truncate">
                <span className="font-medium">{selected.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · seats {selected.capacity}
                </span>
              </span>
              {selectedStatus ? (
                <StatusBadge
                  label={tableStatusLabel(selectedStatus)}
                  tone={tableStatusTone(selectedStatus)}
                  className="shrink-0"
                />
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground truncate">
              {allowNone ? noneLabel : placeholder}
            </span>
          )}
        </span>
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-(--anchor-width) min-w-[16rem] p-0"
      >
        <div className="border-border space-y-2 border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tables…"
              className="h-8 pl-7 text-sm"
              autoFocus
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                !availableOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setAvailableOnly(false);
              }}
            >
              All
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                availableOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setAvailableOnly(true);
              }}
            >
              Available only
            </button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {allowNone ? (
            <DropdownMenuItem
              className="gap-2"
              onClick={() => pick("")}
            >
              <Check
                className={cn(
                  "size-3.5 shrink-0",
                  value ? "opacity-0" : "opacity-100",
                )}
              />
              <span className="text-muted-foreground flex-1">{noneLabel}</span>
            </DropdownMenuItem>
          ) : null}

          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">
              No tables match.
            </p>
          ) : (
            <>
              <DropdownMenuLabel className="px-2">Tables</DropdownMenuLabel>
              {filtered.map((table) => {
                const status = isTableStatus(table.status) ? table.status : null;
                const isSelected = value === table.id;
                return (
                  <DropdownMenuItem
                    key={table.id}
                    className="gap-2"
                    onClick={() => pick(table.id)}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {table.label}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        Seats {table.capacity}
                      </span>
                    </span>
                    {status ? (
                      <StatusBadge
                        label={tableStatusLabel(status)}
                        tone={tableStatusTone(status)}
                        className="shrink-0"
                      />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </div>

        {tables.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <p className="text-muted-foreground px-2.5 py-1.5 text-[11px]">
              {filtered.length} of {tables.length} tables
            </p>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
