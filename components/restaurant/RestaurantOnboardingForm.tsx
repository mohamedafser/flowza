"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createRestaurantRequest } from "@/lib/api/restaurants-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CURRENCIES,
  TIMEZONES,
  restaurantFormSchema,
  type RestaurantFormValues,
} from "@/lib/validations/restaurant";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

function timezoneOptions(): string[] {
  const preferred = COMMON_TIMEZONES.filter((tz) => TIMEZONES.includes(tz));
  const rest = TIMEZONES.filter(
    (tz) => !(COMMON_TIMEZONES as readonly string[]).includes(tz),
  );
  return [...preferred, ...rest];
}

type RestaurantOnboardingFormProps = {
  defaultEmail?: string;
};

export function RestaurantOnboardingForm({
  defaultEmail = "",
}: RestaurantOnboardingFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const zones = timezoneOptions();

  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: {
      name: "",
      email: defaultEmail,
      phone: "",
      website: "",
      description: "",
      currency: "USD",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const result = await createRestaurantRequest(values);

      if (!result.ok) {
        toast.error(result.message ?? "Unable to create restaurant.");
        return;
      }

      toast.success("Restaurant created.");
      router.replace(result.data?.redirectTo ?? "/dashboard/overview");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Restaurant name</Label>
        <Input
          id="name"
          placeholder="Harbor Kitchen"
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            disabled={pending}
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 555 0100"
            disabled={pending}
            aria-invalid={Boolean(form.formState.errors.phone)}
            {...form.register("phone")}
          />
          {form.formState.errors.phone ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.phone.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website (optional)</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://example.com"
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.website)}
          {...form.register("website")}
        />
        {form.formState.errors.website ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.website.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          rows={3}
          disabled={pending}
          aria-invalid={Boolean(form.formState.errors.description)}
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            id="currency"
            disabled={pending}
            aria-invalid={Boolean(form.formState.errors.currency)}
            {...form.register("currency")}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          {form.formState.errors.currency ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.currency.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            id="timezone"
            disabled={pending}
            aria-invalid={Boolean(form.formState.errors.timezone)}
            {...form.register("timezone")}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
          {form.formState.errors.timezone ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.timezone.message}
            </p>
          ) : null}
        </div>
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Creating…" : "Create restaurant"}
      </Button>
    </form>
  );
}
