"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateGeneralSettingsRequest } from "@/lib/api/settings-client";
import { RestaurantLogoUploader } from "@/components/restaurant/RestaurantLogoUploader";
import { SettingsFormActions } from "@/components/settings/SettingsFormActions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { DATE_FORMATS, TIME_FORMATS } from "@/lib/utils/datetime";
import { timezoneOptions } from "@/lib/utils/timezone";
import {
  generalSettingsSchema,
  type GeneralSettingsValues,
} from "@/lib/validations/settings";
import type { Restaurant } from "@/lib/auth/session";
import type { RestaurantSettings } from "@/services/settings";

type GeneralSettingsFormProps = {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  canManage: boolean;
};

function asDateFormat(value: string): GeneralSettingsValues["dateFormat"] {
  return (DATE_FORMATS as readonly string[]).includes(value)
    ? (value as GeneralSettingsValues["dateFormat"])
    : "DD/MM/YYYY";
}

function asTimeFormat(value: string): GeneralSettingsValues["timeFormat"] {
  return (TIME_FORMATS as readonly string[]).includes(value)
    ? (value as GeneralSettingsValues["timeFormat"])
    : "12h";
}

export function GeneralSettingsForm({
  restaurant,
  settings,
  canManage,
}: GeneralSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const zones = timezoneOptions();

  const form = useForm<GeneralSettingsValues>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      name: restaurant.name,
      email: restaurant.email ?? "",
      phone: restaurant.phone ?? "",
      website: restaurant.website ?? "",
      description: restaurant.description ?? "",
      timezone: restaurant.timezone || "UTC",
      dateFormat: asDateFormat(settings.date_format),
      timeFormat: asTimeFormat(settings.time_format),
    },
  });

  const dirty = form.formState.isDirty;
  useUnsavedChanges(dirty && canManage);

  const onSubmit = form.handleSubmit((values) => {
    if (!canManage) return;
    startTransition(async () => {
      const result = await updateGeneralSettingsRequest(restaurant.id, values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to save changes.");
        return;
      }
      toast.success("Restaurant settings updated.");
      form.reset(values);
      router.refresh();
    });
  });

  const disabled = !canManage || pending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Shown in the app header and switcher. JPEG, PNG, WebP, or GIF up to
            2 MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestaurantLogoUploader
            restaurantId={restaurant.id}
            logoUrl={restaurant.logo_url}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Restaurant details</CardTitle>
            <CardDescription>
              Name, contact information, and how this restaurant is identified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant name</Label>
              <Input
                id="name"
                disabled={disabled}
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
                <Label htmlFor="email">Restaurant email</Label>
                <Input
                  id="email"
                  type="email"
                  disabled={disabled}
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-destructive text-xs">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Restaurant phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  disabled={disabled}
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
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                disabled={disabled}
                {...form.register("website")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                disabled={disabled}
                {...form.register("description")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Locale</CardTitle>
            <CardDescription>
              Timezone and how dates and times are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                id="timezone"
                disabled={disabled}
                {...form.register("timezone")}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date format</Label>
                <Select
                  id="dateFormat"
                  disabled={disabled}
                  {...form.register("dateFormat")}
                >
                  {DATE_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeFormat">Time format</Label>
                <Select
                  id="timeFormat"
                  disabled={disabled}
                  {...form.register("timeFormat")}
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <SettingsFormActions
          dirty={dirty}
          pending={pending}
          canManage={canManage}
          onCancel={() => form.reset()}
        />
      </form>
    </div>
  );
}
