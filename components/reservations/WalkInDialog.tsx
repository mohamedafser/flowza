"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { searchQueueCustomersAction } from "@/app/actions/queue";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/common/SearchInput";
import {
  formatPhoneDisplay,
  isValidPhoneInput,
  normalizePhone,
} from "@/lib/utils/phone";
import {
  walkInFormSchema,
  type WalkInFormValues,
} from "@/lib/validations/reservation";
import type { QueueCustomerSearchResult } from "@/services/queues";

type WalkInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queues: Array<{ id: string; name: string; status: string }>;
  tables: Array<{
    id: string;
    label: string;
    capacity: number;
    status: string;
  }>;
  onSubmit: (values: WalkInFormValues) => Promise<void>;
};

type DialogStep = "search" | "create";

export function WalkInDialog({
  open,
  onOpenChange,
  queues,
  tables,
  onSubmit,
}: WalkInDialogProps) {
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
          <WalkInForm
            queues={queues}
            tables={tables}
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

function WalkInForm({
  queues,
  tables,
  submitting,
  setSubmitting,
  onSubmit,
  onCancel,
}: {
  queues: Array<{ id: string; name: string; status: string }>;
  tables: Array<{
    id: string;
    label: string;
    capacity: number;
    status: string;
  }>;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onSubmit: (values: WalkInFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInFormSchema),
    defaultValues: {
      mode: "queue",
      queueId: queues[0]?.id ?? "",
      tableId: "",
      customerId: "",
      name: "",
      phone: "",
      email: "",
      partySize: 2,
      notes: "",
    },
  });

  const mode = form.watch("mode");
  const [step, setStep] = useState<DialogStep>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueueCustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<QueueCustomerSearchResult | null>(
    null,
  );
  const [phoneMatch, setPhoneMatch] =
    useState<QueueCustomerSearchResult | null>(null);

  useEffect(() => {
    if (step !== "search") return;

    let cancelled = false;
    const trimmed = query.trim();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchQueueCustomersAction({ query: trimmed }).then((result) => {
        if (cancelled) return;
        setSearching(false);
        setHasSearched(true);
        setResults(result.ok ? (result.data?.customers ?? []) : []);
      });
    }, trimmed ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, step]);

  const watchedPhone = form.watch("phone");

  useEffect(() => {
    if (step !== "create") return;
    const normalized = normalizePhone(watchedPhone);
    if (!normalized || !isValidPhoneInput(normalized)) {
      setPhoneMatch(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchQueueCustomersAction({ query: normalized }).then((result) => {
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
          form.setValue("name", match.name);
        } else if (!selected) {
          form.setValue("customerId", "");
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [watchedPhone, step, form, selected]);

  const clearSelection = () => {
    setSelected(null);
    setPhoneMatch(null);
    form.setValue("customerId", "");
    form.setValue("name", "");
    form.setValue("phone", "");
    form.setValue("email", "");
  };

  const selectCustomer = (customer: QueueCustomerSearchResult) => {
    setSelected(customer);
    setPhoneMatch(null);
    form.setValue("customerId", customer.id);
    form.setValue("name", customer.name);
    form.setValue("phone", customer.phone ?? "");
    form.setValue("email", "");
    setQuery(customer.name);
    setResults([]);
  };

  const startCreate = () => {
    clearSelection();
    setStep("create");
    const maybePhone = normalizePhone(query);
    if (maybePhone && isValidPhoneInput(maybePhone)) {
      form.setValue("phone", maybePhone);
    } else if (query.trim() && !/\d{3,}/.test(query)) {
      form.setValue("name", query.trim());
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (submitting) return;
    if (step === "search" && !selected) return;
    setSubmitting(true);
    try {
      if (values.customerId) {
        await onSubmit({
          ...values,
          customerId: values.customerId,
        });
        return;
      }
      await onSubmit({
        ...values,
        customerId: undefined,
        phone: normalizePhone(values.phone) ?? values.phone,
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add walk-in</DialogTitle>
        <DialogDescription>
          Seat immediately if a table is free, or add the guest to the queue.
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "queue" ? "default" : "outline"}
            size="sm"
            onClick={() => form.setValue("mode", "queue")}
          >
            Add to queue
          </Button>
          <Button
            type="button"
            variant={mode === "seat" ? "default" : "outline"}
            size="sm"
            onClick={() => form.setValue("mode", "seat")}
          >
            Seat now
          </Button>
        </div>

        {step === "search" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Search customers</Label>
              <SearchInput
                value={query}
                onChange={(next) => {
                  setQuery(next);
                  if (!next.trim()) {
                    setHasSearched(false);
                  }
                }}
                placeholder="Search by name or phone"
                className="max-w-none"
                disabled={submitting}
              />
            </div>

            {selected ? (
              <Alert>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Selected customer
                </p>
                <p className="mt-1 font-medium">{selected.name}</p>
                <p className="text-sm">
                  {selected.phone
                    ? formatPhoneDisplay(selected.phone)
                    : "No phone on file"}
                </p>
                <button
                  type="button"
                  className="mt-2 text-sm underline underline-offset-4"
                  onClick={clearSelection}
                  disabled={submitting}
                >
                  Clear selection
                </button>
              </Alert>
            ) : (
              <div className="border-border max-h-48 overflow-y-auto rounded-lg border">
                {searching ? (
                  <p className="text-muted-foreground px-3 py-2 text-sm">
                    Searching…
                  </p>
                ) : !query.trim() ? (
                  results.length > 0 ? (
                    <>
                      <p className="text-muted-foreground px-3 py-2 text-xs tracking-wide uppercase">
                        Recent customers
                      </p>
                      {results.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          disabled={submitting}
                          className="hover:bg-muted/60 flex w-full flex-col px-3 py-2 text-left text-sm disabled:opacity-50"
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="font-medium">{customer.name}</span>
                          <span className="text-muted-foreground">
                            {customer.phone
                              ? formatPhoneDisplay(customer.phone)
                              : "No phone"}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="text-muted-foreground px-3 py-2 text-sm">
                      Start typing to find a customer.
                    </p>
                  )
                ) : hasSearched && results.length === 0 ? (
                  <div className="space-y-3 px-3 py-3">
                    <p className="text-sm font-medium">Customer not found</p>
                    <p className="text-muted-foreground text-sm">
                      No customer matched “{query.trim()}”.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={startCreate}
                      disabled={submitting}
                    >
                      <UserPlus data-icon="inline-start" />
                      Add Customer
                    </Button>
                  </div>
                ) : (
                  results.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      disabled={submitting}
                      className="hover:bg-muted/60 flex w-full flex-col px-3 py-2 text-left text-sm disabled:opacity-50"
                      onClick={() => selectCustomer(customer)}
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className="text-muted-foreground">
                        {customer.phone
                          ? formatPhoneDisplay(customer.phone)
                          : "No phone"}
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
                onClick={startCreate}
                disabled={submitting}
              >
                <UserPlus data-icon="inline-start" />
                Add new customer instead
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">New customer</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearSelection();
                  setStep("search");
                }}
                disabled={submitting}
              >
                Back to search
              </Button>
            </div>

            {phoneMatch ? (
              <Alert variant="warning">
                <p className="font-medium">Customer already exists</p>
                <p className="mt-1 text-sm">
                  A customer with this phone number already exists.
                </p>
                <p className="mt-2 font-medium">{phoneMatch.name}</p>
                <p className="text-sm">
                  {phoneMatch.phone
                    ? formatPhoneDisplay(phoneMatch.phone)
                    : null}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    selectCustomer(phoneMatch);
                    setStep("search");
                  }}
                  disabled={submitting}
                >
                  Use existing customer
                </Button>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="walk-in-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="walk-in-name"
                disabled={submitting || Boolean(phoneMatch)}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="walk-in-phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    id="walk-in-phone"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={submitting}
                    aria-invalid={Boolean(form.formState.errors.phone)}
                    aria-required="true"
                  />
                )}
              />
              {form.formState.errors.phone ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="walk-in-email">Email</Label>
              <Input
                id="walk-in-email"
                type="email"
                disabled={submitting || Boolean(phoneMatch)}
                {...form.register("email")}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
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

        {mode === "queue" ? (
          <div className="space-y-2">
            <Label htmlFor="queueId">Queue</Label>
            <Select
              id="queueId"
              disabled={submitting}
              {...form.register("queueId")}
            >
              {queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name} ({queue.status})
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tableId">Table</Label>
            <Select
              id="tableId"
              placeholder="Select a table"
              disabled={submitting}
              {...form.register("tableId")}
            >
              <option value="">Select a table</option>
              {tables
                .filter(
                  (table) =>
                    table.status === "AVAILABLE" || table.status === "RESERVED",
                )
                .map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} · seats {table.capacity}
                  </option>
                ))}
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={2}
            disabled={submitting}
            {...form.register("notes")}
          />
        </div>

        <DialogFooter>
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
            disabled={submitting || (step === "search" && !selected)}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : mode === "queue" ? (
              "Add to queue"
            ) : (
              "Seat guest"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
