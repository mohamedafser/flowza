"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { searchQueueCustomersAction } from "@/app/actions/queue";
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
import { SearchInput } from "@/components/common/SearchInput";
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
      <DialogContent className="sm:max-w-lg">
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
      mode: "existing",
      customerId: "",
      name: "",
      phone: "",
      email: "",
      partySize: 2,
    },
  });
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueueCustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (mode !== "existing" || trimmed.length < 1) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchQueueCustomersAction({ query: trimmed }).then((result) => {
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
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  });

  const visibleResults = query.trim() ? results : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add customer</DialogTitle>
        <DialogDescription>
          Link an existing guest or create a new restaurant customer, then set
          the party size.
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "existing" ? "default" : "outline"}
            onClick={() => {
              setMode("existing");
              form.setValue("mode", "existing");
            }}
            disabled={submitting}
          >
            Existing
          </Button>
          <Button
            type="button"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => {
              setMode("new");
              form.setValue("mode", "new");
            }}
            disabled={submitting}
          >
            New customer
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <Label>Search customers</Label>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by name or phone"
              className="max-w-none"
              disabled={submitting}
            />
            <div className="border-border max-h-40 overflow-y-auto rounded-lg border">
              {searching ? (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  Searching…
                </p>
              ) : visibleResults.length === 0 ? (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  {query.trim()
                    ? "No matching customers."
                    : "Start typing to find a customer."}
                </p>
              ) : (
                visibleResults.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    disabled={submitting}
                    className={`flex w-full px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      selectedId === customer.id
                        ? "bg-muted"
                        : "hover:bg-muted/60"
                    }`}
                    onClick={() => {
                      setSelectedId(customer.id);
                      form.setValue("customerId", customer.id);
                    }}
                  >
                    {customer.name}
                  </button>
                ))
              )}
            </div>
            {form.formState.errors.customerId ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.customerId.message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-customer-name">Name</Label>
              <Input
                id="new-customer-name"
                disabled={submitting}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-customer-phone">Phone</Label>
                <Input
                  id="new-customer-phone"
                  disabled={submitting}
                  {...form.register("phone")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-email">Email</Label>
                <Input
                  id="new-customer-email"
                  type="email"
                  disabled={submitting}
                  {...form.register("email")}
                />
              </div>
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
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
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
