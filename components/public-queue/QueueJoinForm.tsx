"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/common/SearchInput";
import { PartySizeSelector } from "@/components/public-queue/PartySizeSelector";
import { QueueTokenCard } from "@/components/public-queue/QueueTokenCard";
import {
  joinPublicQueueRequest,
  searchPublicQueueCustomersRequest,
} from "@/lib/api/public-queue-client";
import { writePublicQueueSession } from "@/lib/public-queue/session";
import {
  formatPhoneDisplay,
  isValidPhoneInput,
  normalizePhone,
} from "@/lib/utils/phone";
import { formatWaitMinutes } from "@/lib/utils/queue";
import {
  joinPublicQueueFormSchema,
  toJoinPublicQueueFormValues,
  type JoinPublicQueueFormValues,
  type PublicQueueCustomerSearchResult,
} from "@/lib/validations/public-queue";
import type {
  PublicQueueInfo,
  PublicQueueJoinResponse,
} from "@/lib/public-queue/types";

type QueueJoinFormProps = {
  info: PublicQueueInfo;
};

type FormStep = "search" | "create";

export function QueueJoinForm({ info }: QueueJoinFormProps) {
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState<PublicQueueJoinResponse | null>(null);
  const [step, setStep] = useState<FormStep>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicQueueCustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] =
    useState<PublicQueueCustomerSearchResult | null>(null);

  const schema = useMemo(
    () =>
      joinPublicQueueFormSchema({
        requirePhone: info.settings.requireCustomerPhone,
        maxPartySize: info.settings.maxPartySize,
      }),
    [info.settings.requireCustomerPhone, info.settings.maxPartySize],
  );

  const form = useForm<JoinPublicQueueFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toJoinPublicQueueFormValues(),
  });
  const partySize = useWatch({ control: form.control, name: "partySize" });

  useEffect(() => {
    if (step !== "search") return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchPublicQueueCustomersRequest({
        restaurantSlug: info.restaurant.slug,
        branchSlug: info.branch.slug,
        query: trimmed,
      }).then((result) => {
        if (cancelled) return;
        setSearching(false);
        setHasSearched(true);
        setResults(result.ok ? (result.data?.customers ?? []) : []);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, step, info.restaurant.slug, info.branch.slug]);

  const clearSelection = () => {
    setSelected(null);
    form.setValue("name", "");
    form.setValue("phone", "");
  };

  const selectCustomer = (customer: PublicQueueCustomerSearchResult) => {
    setSelected(customer);
    form.setValue("name", customer.name, { shouldValidate: true });
    form.setValue("phone", customer.phone ?? "", { shouldValidate: true });
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

  const onSubmit = form.handleSubmit(async (values) => {
    if (pending || !info.availability.canJoin) return;
    if (step === "search" && !selected) return;
    setPending(true);
    try {
      const phone = values.phone.trim()
        ? (normalizePhone(values.phone) ?? values.phone)
        : "";
      const result = await joinPublicQueueRequest({
        restaurantSlug: info.restaurant.slug,
        branchSlug: info.branch.slug,
        name: values.name,
        phone,
        partySize: values.partySize,
      });
      if (!result.ok || !result.data) {
        toast.error(result.message ?? "Unable to join the queue.");
        if (result.message) {
          form.setError("root", { message: result.message });
        }
        return;
      }
      writePublicQueueSession({
        restaurantSlug: info.restaurant.slug,
        branchSlug: info.branch.slug,
        accessToken: result.data.accessToken,
      });
      setJoined(result.data);
    } finally {
      setPending(false);
    }
  });

  if (joined) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {joined.reused
              ? "You're already in the queue"
              : "You're in the queue!"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Keep this page or bookmark your status link. We saved it on this
            device only.
          </p>
        </div>
        <QueueTokenCard token={joined.status.entry.token} />
        <dl className="border-border bg-card grid grid-cols-2 gap-3 rounded-2xl border p-4">
          {info.settings.showPartySize ? (
            <div>
              <dt className="text-muted-foreground text-sm">Party size</dt>
              <dd className="text-lg font-semibold">
                {joined.status.entry.partySize}
              </dd>
            </div>
          ) : null}
          {info.settings.showEstimatedWait ? (
            <div>
              <dt className="text-muted-foreground text-sm">Estimated wait</dt>
              <dd className="text-lg font-semibold">
                {joined.status.entry.estimatedWaitMinutes == null
                  ? "Unavailable"
                  : formatWaitMinutes(joined.status.entry.estimatedWaitMinutes)}
              </dd>
            </div>
          ) : null}
        </dl>
        <Button
          size="lg"
          className="h-12 w-full text-base"
          render={<Link href={joined.statusPath} />}
          nativeButton={false}
        >
          View queue status
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {form.formState.errors.root?.message ? (
        <Alert variant="destructive" title="Unable to join">
          {form.formState.errors.root.message}
        </Alert>
      ) : null}

      {step === "search" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="queue-join-search">Search customers</Label>
            <SearchInput
              id="queue-join-search"
              value={query}
              onChange={(next) => {
                setQuery(next);
                if (selected) clearSelection();
                if (!next.trim()) {
                  setResults([]);
                  setHasSearched(false);
                }
              }}
              placeholder="Search by name or phone"
              className="max-w-none [&_input]:h-12 [&_input]:text-base"
              disabled={pending}
            />
          </div>

          {selected ? (
            <div className="space-y-3">
              <Alert>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Selected
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
                  onClick={() => {
                    clearSelection();
                    setQuery("");
                  }}
                  disabled={pending}
                >
                  Clear selection
                </button>
              </Alert>
              {!selected.phone && info.settings.requireCustomerPhone ? (
                <div className="space-y-2">
                  <Label htmlFor="queue-join-phone-selected">
                    Phone
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Controller
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <PhoneInput
                        id="queue-join-phone-selected"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={pending}
                        required
                        aria-required
                        aria-invalid={Boolean(form.formState.errors.phone)}
                        className="h-12 text-base"
                        inputClassName="h-12 text-base md:text-base"
                      />
                    )}
                  />
                  {form.formState.errors.phone ? (
                    <p className="text-destructive text-sm" role="alert">
                      {form.formState.errors.phone.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="border-border max-h-56 overflow-y-auto rounded-xl border">
              {searching ? (
                <p className="text-muted-foreground px-3 py-3 text-sm">
                  Searching…
                </p>
              ) : query.trim().length < 2 ? (
                <p className="text-muted-foreground px-3 py-3 text-sm">
                  Type at least 2 characters to find your name or phone.
                </p>
              ) : hasSearched && results.length === 0 ? (
                <div className="space-y-3 px-3 py-3">
                  <p className="text-sm font-medium">No match found</p>
                  <p className="text-muted-foreground text-sm">
                    No customer matched “{query.trim()}”.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={startCreate}
                    disabled={pending}
                  >
                    <UserPlus data-icon="inline-start" />
                    Continue as new guest
                  </Button>
                </div>
              ) : (
                results.map((customer) => (
                  <button
                    key={`${customer.name}-${customer.phone ?? "none"}`}
                    type="button"
                    disabled={pending}
                    className="hover:bg-muted/60 flex w-full flex-col px-3 py-3 text-left text-sm disabled:opacity-50"
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

          {!selected && query.trim().length >= 2 && results.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCreate}
              disabled={pending}
            >
              <UserPlus data-icon="inline-start" />
              I&apos;m a new guest
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">New guest</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearSelection();
                setStep("search");
              }}
              disabled={pending}
            >
              Back to search
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue-join-name">
              Name
              {info.settings.requireCustomerName ? (
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              ) : null}
            </Label>
            <Input
              id="queue-join-name"
              autoComplete="name"
              autoCapitalize="words"
              className="h-12 text-base"
              disabled={pending}
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm" role="alert">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue-join-phone">
              Phone
              {info.settings.requireCustomerPhone ? (
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              ) : null}
            </Label>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="queue-join-phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={pending}
                  required={info.settings.requireCustomerPhone}
                  aria-required={info.settings.requireCustomerPhone}
                  aria-invalid={Boolean(form.formState.errors.phone)}
                  className="h-12 text-base"
                  inputClassName="h-12 text-base md:text-base"
                />
              )}
            />
            {form.formState.errors.phone ? (
              <p className="text-destructive text-sm" role="alert">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <PartySizeSelector
        id="queue-join-party-size"
        value={partySize ?? 2}
        max={info.settings.maxPartySize}
        disabled={pending}
        error={form.formState.errors.partySize?.message}
        onChange={(value) =>
          form.setValue("partySize", value, { shouldValidate: true })
        }
      />

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full text-base"
        disabled={
          pending ||
          !info.availability.canJoin ||
          (step === "search" && !selected)
        }
      >
        {pending ? "Joining…" : "Join queue"}
      </Button>
    </form>
  );
}
