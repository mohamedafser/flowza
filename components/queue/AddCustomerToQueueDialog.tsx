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
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/common/SearchInput";
import {
  formatPhoneDisplay,
  isValidPhoneInput,
  normalizePhone,
} from "@/lib/utils/phone";
import {
  addCustomerFormSchema,
  type AddCustomerFormValues,
} from "@/lib/validations/queue";
import type { QueueCustomerSearchResult } from "@/services/queues";

type AddCustomerToQueueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AddCustomerFormValues) => Promise<void>;
};

type DialogStep = "search" | "create";

export function AddCustomerToQueueDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddCustomerToQueueDialogProps) {
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
          <AddCustomerForm
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

function AddCustomerForm({
  submitting,
  setSubmitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  onSubmit: (values: AddCustomerFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<AddCustomerFormValues>({
    resolver: zodResolver(addCustomerFormSchema),
    defaultValues: {
      customerId: "",
      name: "",
      phone: "",
      email: "",
      partySize: 2,
    },
  });

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
    if (step !== "search") {
      return;
    }

    let cancelled = false;
    const trimmed = query.trim();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchQueueCustomersRequest(trimmed).then((result) => {
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
    if (step !== "create") {
      return;
    }
    const normalized = normalizePhone(watchedPhone);
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

  const handleSubmit = form.handleSubmit(async (values) => {
    if (submitting) return;
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

  const selectCustomer = (customer: QueueCustomerSearchResult) => {
    setSelected(customer);
    setPhoneMatch(null);
    form.setValue("customerId", customer.id);
    form.setValue("name", customer.name);
    form.setValue("phone", customer.phone ?? "");
    form.clearErrors();
  };

  const clearSelection = () => {
    setSelected(null);
    setPhoneMatch(null);
    form.setValue("customerId", "");
    form.setValue("name", "");
    form.setValue("phone", "");
    form.setValue("email", "");
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

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add customer</DialogTitle>
        <DialogDescription>
          Search for an existing guest by name or phone, or add a new customer
          to the queue.
        </DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {step === "search" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Search customers</Label>
              <SearchInput
                value={query}
                onChange={(next) => {
                  setQuery(next);
                  if (!next.trim()) {
                    setResults([]);
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
              <Label htmlFor="new-customer-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-customer-name"
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
              <Label htmlFor="new-customer-phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    id="new-customer-phone"
                    value={field.value}
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
              <Label htmlFor="new-customer-email">Email</Label>
              <Input
                id="new-customer-email"
                type="email"
                disabled={submitting || Boolean(phoneMatch)}
                {...form.register("email")}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="party-size">Party size</Label>
          <Input
            id="party-size"
            type="number"
            min={1}
            max={50}
            disabled={submitting}
            {...form.register("partySize")}
          />
          {form.formState.errors.partySize ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.partySize.message}
            </p>
          ) : null}
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
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Adding…
              </>
            ) : (
              "Add to queue"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
