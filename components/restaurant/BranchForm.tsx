"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createBranchRequest,
  updateBranchRequest,
} from "@/lib/api/branches-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { slugify } from "@/lib/utils/slug";
import { timezoneOptions } from "@/lib/utils/timezone";
import {
  branchFieldsSchema,
  type BranchFormValues,
} from "@/lib/validations/branch";
import type { Branch } from "@/lib/context/restaurant";

type BranchFormProps = {
  mode: "create" | "edit";
  restaurantId: string;
  branch?: Branch;
  canManage: boolean;
  defaultTimezone?: string;
};

export function BranchForm({
  mode,
  restaurantId,
  branch,
  canManage,
  defaultTimezone = "UTC",
}: BranchFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const zones = timezoneOptions();

  const [autoSlug, setAutoSlug] = useState(mode === "create");
  const [useRestaurantTimezone, setUseRestaurantTimezone] = useState(
    branch?.use_restaurant_timezone ?? true,
  );

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFieldsSchema),
    defaultValues: {
      name: branch?.name ?? "",
      slug: branch?.slug ?? "",
      addressLine1: branch?.address_line_1 ?? "",
      addressLine2: branch?.address_line_2 ?? "",
      city: branch?.city ?? "",
      state: branch?.state ?? "",
      postalCode: branch?.postal_code ?? "",
      country: branch?.country ?? "",
      phone: branch?.phone ?? "",
      email: branch?.email ?? "",
      timezone: branch?.timezone ?? defaultTimezone,
      useRestaurantTimezone: branch?.use_restaurant_timezone ?? true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!canManage) return;
    setPending(true);
    try {
      if (mode === "create") {
        const result = await createBranchRequest(restaurantId, values);
        if (!result.ok) {
          toast.error(result.message ?? "Unable to create branch.");
          return;
        }
        toast.success("Branch created.");
        router.push(`/settings/branches/${result.data?.branch.id}`);
        router.refresh();
        return;
      }

      if (!branch) return;
      const result = await updateBranchRequest(branch.id, values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to update branch.");
        return;
      }
      toast.success("Branch updated.");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  });

  const disabled = !canManage || pending;

  return (
    <form className="max-w-2xl space-y-4" onSubmit={onSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            disabled={disabled}
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name", {
              onChange: (event) => {
                if (mode === "create" && autoSlug) {
                  form.setValue("slug", slugify(event.target.value || ""), {
                    shouldValidate: false,
                  });
                }
              },
            })}
          />
          {form.formState.errors.name ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            disabled={disabled}
            aria-invalid={Boolean(form.formState.errors.slug)}
            {...form.register("slug", {
              onChange: () => {
                if (mode === "create") {
                  setAutoSlug(false);
                }
              },
            })}
          />
          {form.formState.errors.slug ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.slug.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input
          id="addressLine1"
          disabled={disabled}
          {...form.register("addressLine1")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2</Label>
        <Input
          id="addressLine2"
          disabled={disabled}
          {...form.register("addressLine2")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" disabled={disabled} {...form.register("city")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" disabled={disabled} {...form.register("state")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            disabled={disabled}
            {...form.register("postalCode")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            disabled={disabled}
            {...form.register("country")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            disabled={disabled}
            {...form.register("phone")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            disabled={disabled}
            {...form.register("email")}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            id="useRestaurantTimezone"
            checked={useRestaurantTimezone}
            disabled={disabled}
            onCheckedChange={(checked) => {
              setUseRestaurantTimezone(checked);
              form.setValue("useRestaurantTimezone", checked, {
                shouldDirty: true,
              });
              if (checked) {
                form.setValue("timezone", defaultTimezone, {
                  shouldDirty: true,
                });
              }
            }}
          />
          <span>
            Use restaurant timezone
            <span className="text-muted-foreground mt-0.5 block">
              {defaultTimezone}. Turn this off to set a branch-specific
              timezone.
            </span>
          </span>
        </label>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            id="timezone"
            disabled={disabled || useRestaurantTimezone}
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
          {pending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create branch"
              : "Save changes"}
        </Button>
      ) : (
        <p className="text-muted-foreground text-sm">
          Viewing only — restaurant.manage is required to edit branches.
        </p>
      )}
    </form>
  );
}
