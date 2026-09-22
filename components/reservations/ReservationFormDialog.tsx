"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { searchQueueCustomersRequest } from "@/lib/api/queues-client";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/common/SearchInput";
import {
  DEFAULT_DURATION_MINUTES,
  reservationFormSchema,
  type ReservationFormValues,
} from "@/lib/validations/reservation";
import type { QueueCustomerSearchResult } from "@/services/queues";
import type { ReservationWithRelations } from "@/lib/utils/reservations";
import { formatReservationTime } from "@/lib/utils/reservations";

type TableOption = {
  id: string;
  capacity: number;
  status: string;
  label: string;
};

type ReservationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  reservation?: ReservationWithRelations | null;
  tables: TableOption[];
  defaultDate: string;
  onSubmit: (values: ReservationFormValues) => Promise<void>;
};

export function ReservationFormDialog({
  open,
  onOpenChange,
  mode,
  reservation,
  tables,
  defaultDate,
  onSubmit,
}: ReservationFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open ? (
          <ReservationForm
            mode={mode}
            reservation={reservation}
            tables={tables}
            defaultDate={defaultDate}
            submitting={submitting}
            setSubmitting={setSubmitting}
            onSubmit={onSubmit}
            onCancel={() => {
              if (!submitting) onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReservationForm({
  mode,
  reservation,
  tables,
  defaultDate,
  submitting,
  setSubmitting,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  reservation?: ReservationWithRelations | null;
  tables: TableOption[];
  defaultDate: string;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onSubmit: (values: ReservationFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: {
      customerId: reservation?.customer_id ?? "",
      reservationDate: reservation?.reservation_date ?? defaultDate,
      startTime: reservation
        ? formatReservationTime(reservation.start_time)
        : "19:00",
      partySize: reservation?.party_size ?? 2,
      durationMinutes:
        reservation?.duration_minutes ?? DEFAULT_DURATION_MINUTES,
      tableId: reservation?.table_id ?? "",
      notes: reservation?.notes ?? "",
      specialRequests: reservation?.special_requests ?? "",
      confirm: reservation?.status === "CONFIRMED",
    },
  });

  const [query, setQuery] = useState(reservation?.customer?.name ?? "");
  const [results, setResults] = useState<QueueCustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedName, setSelectedName] = useState(
    reservation?.customer?.name ?? "",
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (mode === "edit" || trimmed.length < 1) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchQueueCustomersRequest(trimmed).then((result) => {
        if (cancelled) return;
        setSearching(false);
        setResults(result.ok ? (result.data?.customers ?? []) : []);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        tableId: values.tableId || null,
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "New reservation" : "Edit reservation"}
        </DialogTitle>
        <DialogDescription>
          Book a table for a customer. Times use the branch timezone.
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "create" ? (
          <div className="space-y-2">
            <Label>Customer</Label>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search customers"
            />
            {selectedName ? (
              <p className="text-muted-foreground text-sm">
                Selected: {selectedName}
              </p>
            ) : null}
            {searching ? (
              <p className="text-muted-foreground text-sm">Searching…</p>
            ) : null}
            {results.length > 0 ? (
              <ul className="border-border max-h-36 overflow-y-auto rounded-md border">
                {results.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                      onClick={() => {
                        form.setValue("customerId", customer.id, {
                          shouldValidate: true,
                        });
                        setSelectedName(customer.name);
                        setQuery(customer.name);
                        setResults([]);
                      }}
                    >
                      {customer.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {form.formState.errors.customerId ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.customerId.message}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <Label>Customer</Label>
            <p className="text-sm font-medium">
              {reservation?.customer?.name ?? "Unknown"}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reservationDate">Date</Label>
            <Input
              id="reservationDate"
              type="date"
              {...form.register("reservationDate")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startTime">Time</Label>
            <Input id="startTime" type="time" {...form.register("startTime")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="partySize">Party size</Label>
            <Input
              id="partySize"
              type="number"
              min={1}
              max={50}
              {...form.register("partySize")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Duration (min)</Label>
            <Input
              id="durationMinutes"
              type="number"
              min={15}
              max={480}
              step={15}
              {...form.register("durationMinutes")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tableId">Table (optional)</Label>
          <Select id="tableId" {...form.register("tableId")}>
            <option value="">No preference</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.label} · seats {table.capacity} · {table.status}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} {...form.register("notes")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialRequests">Special requests</Label>
          <Textarea
            id="specialRequests"
            rows={2}
            {...form.register("specialRequests")}
          />
        </div>

        {mode === "create" ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(form.watch("confirm"))}
              onCheckedChange={(checked) =>
                form.setValue("confirm", checked === true)
              }
            />
            Confirm immediately
          </label>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : mode === "create" ? (
              "Create reservation"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
