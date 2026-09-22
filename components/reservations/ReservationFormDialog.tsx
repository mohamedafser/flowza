"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { searchQueueCustomersRequest } from "@/lib/api/queues-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/common/SearchInput";
import { TableStatusPicker } from "@/components/reservations/TableStatusPicker";
import {
  formatPhoneDisplay,
  isValidPhoneInput,
  normalizePhone,
} from "@/lib/utils/phone";
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

type CustomerStep = "search" | "create";

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
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 overflow-y-auto p-4 sm:max-w-3xl">
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
      name: "",
      phone: "",
      email: "",
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
      arrived: false,
    },
  });

  const [customerStep, setCustomerStep] = useState<CustomerStep>("search");
  const [query, setQuery] = useState(reservation?.customer?.name ?? "");
  const [results, setResults] = useState<QueueCustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<QueueCustomerSearchResult | null>(
    reservation?.customer
      ? {
          id: reservation.customer.id,
          name: reservation.customer.name,
          phone: reservation.customer.phone ?? null,
        }
      : null,
  );
  const [phoneMatch, setPhoneMatch] =
    useState<QueueCustomerSearchResult | null>(null);

  useEffect(() => {
    if (mode === "edit" || customerStep !== "search") return;

    let cancelled = false;
    const trimmed = query.trim();
    const timer = window.setTimeout(
      () => {
        setSearching(true);
        void searchQueueCustomersRequest(trimmed).then((result) => {
          if (cancelled) return;
          setSearching(false);
          setHasSearched(true);
          setResults(result.ok ? (result.data?.customers ?? []) : []);
        });
      },
      trimmed ? 250 : 0,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode, customerStep]);

  const watchedPhone = form.watch("phone");

  useEffect(() => {
    if (mode === "edit" || customerStep !== "create") return;
    const normalized = normalizePhone(watchedPhone ?? "");
    if (!normalized || !isValidPhoneInput(normalized)) {
      setPhoneMatch(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchQueueCustomersRequest(normalized).then((result) => {
        if (cancelled) return;
        const customers = result.ok ? (result.data?.customers ?? []) : [];
        const match =
          customers.find((customer) => {
            const customerPhone = normalizePhone(customer.phone);
            return customerPhone === normalized;
          }) ?? null;
        setPhoneMatch(match);
        if (match) {
          form.setValue("customerId", match.id);
        } else {
          form.setValue("customerId", "");
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [watchedPhone, customerStep, mode, form]);

  const clearSelection = () => {
    setSelected(null);
    form.setValue("customerId", "");
    form.setValue("name", "");
    form.setValue("phone", "");
    form.setValue("email", "");
  };

  const selectCustomer = (customer: QueueCustomerSearchResult) => {
    setSelected(customer);
    form.setValue("customerId", customer.id, { shouldValidate: true });
    form.setValue("name", customer.name);
    form.setValue("phone", customer.phone ?? "");
    form.setValue("email", "");
    setQuery(customer.name);
    setResults([]);
    setPhoneMatch(null);
    setCustomerStep("search");
  };

  const startCreate = () => {
    clearSelection();
    setCustomerStep("create");
    const trimmed = query.trim();
    if (trimmed && !/^\+?\d[\d\s()-]*$/.test(trimmed)) {
      form.setValue("name", trimmed);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (submitting) return;
    if (mode === "create" && customerStep === "search" && !selected) {
      form.setError("customerId", { message: "Select or add a customer." });
      return;
    }
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
      <DialogHeader className="gap-1 pr-8">
        <DialogTitle>
          {mode === "create" ? "New reservation" : "Edit reservation"}
        </DialogTitle>
        <DialogDescription>Times use the branch timezone.</DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        {mode === "create" ? (
          customerStep === "search" ? (
            <div className="space-y-2">
              <Label>Customer</Label>
              <SearchInput
                value={query}
                onChange={(next) => {
                  setQuery(next);
                  if (!next.trim()) setHasSearched(false);
                }}
                placeholder="Search by name or phone"
                className="max-w-none"
                disabled={submitting}
              />

              {selected ? (
                <Alert className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {selected.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {selected.phone
                          ? formatPhoneDisplay(selected.phone)
                          : "No phone on file"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground shrink-0 text-xs underline underline-offset-4"
                      onClick={clearSelection}
                      disabled={submitting}
                    >
                      Clear
                    </button>
                  </div>
                </Alert>
              ) : (
                <div className="border-border max-h-28 overflow-y-auto rounded-lg border">
                  {searching ? (
                    <p className="text-muted-foreground px-2.5 py-2 text-xs">
                      Searching…
                    </p>
                  ) : !query.trim() ? (
                    results.length > 0 ? (
                      <>
                        <p className="text-muted-foreground px-2.5 py-1 text-[11px] tracking-wide uppercase">
                          Recent
                        </p>
                        {results.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            disabled={submitting}
                            className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm disabled:opacity-50"
                            onClick={() => selectCustomer(customer)}
                          >
                            <span className="truncate font-medium">
                              {customer.name}
                            </span>
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {customer.phone
                                ? formatPhoneDisplay(customer.phone)
                                : "—"}
                            </span>
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="text-muted-foreground px-2.5 py-2 text-xs">
                        Start typing to find a customer.
                      </p>
                    )
                  ) : hasSearched && results.length === 0 ? (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <p className="text-sm">No match for “{query.trim()}”.</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={startCreate}
                        disabled={submitting}
                      >
                        <UserPlus data-icon="inline-start" />
                        Add
                      </Button>
                    </div>
                  ) : (
                    results.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        disabled={submitting}
                        className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm disabled:opacity-50"
                        onClick={() => selectCustomer(customer)}
                      >
                        <span className="truncate font-medium">
                          {customer.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {customer.phone
                            ? formatPhoneDisplay(customer.phone)
                            : "—"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {!selected && query.trim() && results.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={startCreate}
                  disabled={submitting}
                >
                  <UserPlus data-icon="inline-start" />
                  Add new instead
                </Button>
              ) : null}

              {form.formState.errors.customerId ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.customerId.message}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>New customer</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearSelection();
                    setCustomerStep("search");
                  }}
                  disabled={submitting}
                >
                  Back
                </Button>
              </div>

              {phoneMatch ? (
                <Alert variant="warning" className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {phoneMatch.name} already exists
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => selectCustomer(phoneMatch)}
                      disabled={submitting}
                    >
                      Use existing
                    </Button>
                  </div>
                </Alert>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reservation-customer-name">Name</Label>
                  <Input
                    id="reservation-customer-name"
                    disabled={submitting || Boolean(phoneMatch)}
                    {...form.register("name")}
                  />
                  {form.formState.errors.name ? (
                    <p className="text-destructive text-xs">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reservation-customer-phone">Phone</Label>
                  <Controller
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <PhoneInput
                        id="reservation-customer-phone"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={submitting}
                      />
                    )}
                  />
                  {form.formState.errors.phone ? (
                    <p className="text-destructive text-xs">
                      {form.formState.errors.phone.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reservation-customer-email">
                    Email (optional)
                  </Label>
                  <Input
                    id="reservation-customer-email"
                    type="email"
                    disabled={submitting || Boolean(phoneMatch)}
                    {...form.register("email")}
                  />
                </div>
              </div>
            </div>
          )
        ) : (
          <div>
            <Label>Customer</Label>
            <p className="text-sm font-medium">
              {reservation?.customer?.name ?? "Unknown"}
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="reservationDate">Date</Label>
            <Input
              id="reservationDate"
              type="date"
              disabled={submitting}
              {...form.register("reservationDate")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startTime">Time</Label>
            <Input
              id="startTime"
              type="time"
              disabled={submitting}
              {...form.register("startTime")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partySize">Party size</Label>
            <Input
              id="partySize"
              type="number"
              min={1}
              max={50}
              disabled={submitting}
              {...form.register("partySize")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes">Duration (min)</Label>
            <Input
              id="durationMinutes"
              type="number"
              min={15}
              max={480}
              step={15}
              disabled={submitting}
              {...form.register("durationMinutes")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Table (optional)</Label>
          <TableStatusPicker
            tables={tables}
            value={form.watch("tableId") ?? ""}
            onChange={(tableId) =>
              form.setValue("tableId", tableId, { shouldDirty: true })
            }
            disabled={submitting}
            allowNone
            noneLabel="No preference"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 sm:items-start">
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              className="min-h-14 resize-y"
              disabled={submitting}
              {...form.register("notes")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="specialRequests">Special requests</Label>
            <Textarea
              id="specialRequests"
              rows={2}
              className="min-h-14 resize-y"
              disabled={submitting}
              {...form.register("specialRequests")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          {mode === "create" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(form.watch("confirm"))}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    form.setValue("confirm", next);
                    if (!next) form.setValue("arrived", false);
                  }}
                  disabled={submitting || Boolean(form.watch("arrived"))}
                />
                Confirm immediately
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(form.watch("arrived"))}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    form.setValue("arrived", next);
                    if (next) form.setValue("confirm", true);
                  }}
                  disabled={submitting}
                />
                Customer arrived
              </label>
            </div>
          ) : (
            <span />
          )}

          <DialogFooter className="m-0 gap-2 border-0 p-0 sm:ms-auto sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                (mode === "create" && customerStep === "search" && !selected) ||
                (mode === "create" &&
                  customerStep === "create" &&
                  Boolean(phoneMatch))
              }
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Saving…
                </>
              ) : mode === "create" ? (
                "Create reservation"
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </div>
      </form>
    </>
  );
}
