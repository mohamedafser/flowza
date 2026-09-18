"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateRestaurantRequest } from "@/lib/api/restaurants-client";
import { RestaurantLogoUploader } from "@/components/restaurant/RestaurantLogoUploader";
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
import type { Restaurant } from "@/lib/auth/session";

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

type RestaurantSettingsFormProps = {
  restaurant: Restaurant;
  canManage: boolean;
};

function asCurrency(value: string): RestaurantFormValues["currency"] {
  return (CURRENCIES as readonly string[]).includes(value)
    ? (value as RestaurantFormValues["currency"])
    : "USD";
}

export function RestaurantSettingsForm({
  restaurant,
  canManage,
}: RestaurantSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const zones = timezoneOptions();

  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: {
      name: restaurant.name,
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      website: restaurant.website ?? "",
      description: restaurant.description ?? "",
      currency: asCurrency(restaurant.currency),
      timezone: restaurant.timezone || "UTC",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!canManage) return;
    startTransition(async () => {
      const result = await updateRestaurantRequest(restaurant.id, values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to save changes.");
        return;
      }
      toast.success("Restaurant updated.");
      router.refresh();
    });
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Logo</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Shown in the app header and switcher. JPEG, PNG, WebP, or GIF up to
            2 MB.
          </p>
        </div>
        <RestaurantLogoUploader
          restaurantId={restaurant.id}
          logoUrl={restaurant.logo_url}
          canManage={canManage}
        />
      </section>

      <form className="max-w-2xl space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Restaurant name</Label>
          <Input
            id="name"
            disabled={!canManage || pending}
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
              disabled={!canManage || pending}
              {...form.register("email")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              disabled={!canManage || pending}
              {...form.register("phone")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            disabled={!canManage || pending}
            {...form.register("website")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            disabled={!canManage || pending}
            {...form.register("description")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              disabled={!canManage || pending}
              {...form.register("currency")}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              id="timezone"
              disabled={!canManage || pending}
              {...form.register("timezone")}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {canManage ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            You can view restaurant details. Editing requires the
            restaurant.manage permission.
          </p>
        )}
      </form>
    </div>
  );
}
