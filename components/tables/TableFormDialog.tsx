"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  COMMON_TABLE_CAPACITIES,
  TABLE_STATUSES,
  TABLE_STATUS_LABELS,
  tableFieldsSchema,
  type TableFormValues,
} from "@/lib/validations/table";
import type { TableSectionRecord, TableWithSection } from "@/lib/utils/tables";

type TableFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  table?: TableWithSection | null;
  sections: TableSectionRecord[];
  pending: boolean;
  onSubmit: (values: TableFormValues) => Promise<void> | void;
};

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}

function toFormValues(table?: TableWithSection | null): TableFormValues {
  return {
    tableNumber: table?.table_number ?? "",
    name: table?.name ?? "",
    sectionId: table?.section_id ?? "",
    capacity: table?.capacity ?? 2,
    status: table?.status ?? "AVAILABLE",
    sortOrder: table?.sort_order ?? 0,
  };
}

function TableFormFields({
  mode,
  table,
  sections,
  pending,
  onSubmit,
  onCancel,
}: Omit<TableFormDialogProps, "open" | "onOpenChange"> & {
  onCancel: () => void;
}) {
  const initial = toFormValues(table);
  const form = useForm<TableFormValues>({
    resolver: zodResolver(tableFieldsSchema),
    defaultValues: initial,
  });
  const [capacity, setCapacity] = useState(initial.capacity);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tableNumber">
            Table number <RequiredMark />
          </Label>
          <Input
            id="tableNumber"
            autoComplete="off"
            required
            aria-required="true"
            disabled={pending}
            aria-invalid={Boolean(form.formState.errors.tableNumber)}
            {...form.register("tableNumber")}
          />
          {form.formState.errors.tableNumber ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.tableNumber.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tableName">Display name</Label>
          <Input
            id="tableName"
            autoComplete="off"
            placeholder="Optional"
            disabled={pending}
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sectionId">Section</Label>
        <Select
          id="sectionId"
          disabled={pending}
          {...form.register("sectionId")}
        >
          <option value="">No section</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>
        {sections.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No sections yet. You can still create this table and assign a
            section later.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacity">
          Capacity <RequiredMark />
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_TABLE_CAPACITIES.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={capacity === value ? "default" : "outline"}
              disabled={pending}
              onClick={() => {
                setCapacity(value);
                form.setValue("capacity", value, { shouldDirty: true });
              }}
            >
              {value === 10 ? "10+" : value}
            </Button>
          ))}
        </div>
        <Input
          id="capacity"
          type="number"
          min={1}
          max={999}
          inputMode="numeric"
          required
          aria-required="true"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.capacity)}
          {...form.register("capacity", {
            valueAsNumber: true,
            onChange: (event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) {
                setCapacity(next);
              }
            },
          })}
        />
        {form.formState.errors.capacity ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.capacity.message}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Any positive whole number is allowed.
          </p>
        )}
      </div>

      {mode === "create" ? (
        <div className="space-y-2">
          <Label htmlFor="status">
            Status <RequiredMark />
          </Label>
          <Select
            id="status"
            required
            aria-required="true"
            disabled={pending}
            {...form.register("status")}
          >
            {TABLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TABLE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            type="number"
            min={0}
            max={10000}
            inputMode="numeric"
            disabled={pending}
            {...form.register("sortOrder", { valueAsNumber: true })}
          />
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Add table"
              : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TableFormDialog({
  open,
  onOpenChange,
  mode,
  table,
  sections,
  pending,
  onSubmit,
}: TableFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add table" : "Edit table"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a table for the current branch. Table numbers must be unique in this branch."
              : "Update this table’s number, section, capacity, and order. Branch cannot be changed."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TableFormFields
            key={table?.id ?? "create"}
            mode={mode}
            table={table}
            sections={sections}
            pending={pending}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
