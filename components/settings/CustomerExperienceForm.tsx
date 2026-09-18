"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateCustomerExperienceRequest } from "@/lib/api/settings-client";
import { SettingsFormActions } from "@/components/settings/SettingsFormActions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  customerExperienceSchema,
  type CustomerExperienceValues,
} from "@/lib/validations/settings";
import type { RestaurantSettings } from "@/services/settings";

type CustomerExperienceFormProps = {
  restaurantId: string;
  settings: RestaurantSettings;
  canManage: boolean;
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

export function CustomerExperienceForm({
  restaurantId,
  settings,
  canManage,
}: CustomerExperienceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CustomerExperienceValues>({
    resolver: zodResolver(customerExperienceSchema),
    defaultValues: {
      showEstimatedWait: settings.show_estimated_wait,
      showQueuePosition: settings.show_queue_position,
      showPartySize: settings.show_party_size,
      allowCustomerCancel: settings.allow_customer_cancel,
      allowSelfCheckIn: settings.allow_self_check_in,
      requireCustomerName: settings.require_customer_name,
      requireCustomerPhone: settings.require_customer_phone,
    },
  });

  const dirty = form.formState.isDirty;
  useUnsavedChanges(dirty && canManage);

  const onSubmit = form.handleSubmit((values) => {
    if (!canManage) return;
    startTransition(async () => {
      const result = await updateCustomerExperienceRequest(
        restaurantId,
        values,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Unable to save customer settings.");
        return;
      }
      toast.success("Customer experience settings updated.");
      form.reset(values);
      router.refresh();
    });
  });

  const disabled = !canManage || pending;

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Guest-facing display</CardTitle>
          <CardDescription>
            What customers will see on future queue screens. Nothing is shown to
            guests in this phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={form.control}
            name="showEstimatedWait"
            render={({ field }) => (
              <ToggleRow
                id="cx-showEstimatedWait"
                label="Show estimated wait time"
                description="Display a wait estimate to guests."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="showQueuePosition"
            render={({ field }) => (
              <ToggleRow
                id="cx-showQueuePosition"
                label="Show queue position"
                description="Show how many parties are ahead."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="showPartySize"
            render={({ field }) => (
              <ToggleRow
                id="showPartySize"
                label="Show party size"
                description="Include party size on customer-facing queue views."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guest actions</CardTitle>
          <CardDescription>
            Self check-in, cancellation, and required guest details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={form.control}
            name="allowSelfCheckIn"
            render={({ field }) => (
              <ToggleRow
                id="cx-allowSelfCheckIn"
                label="Allow customer self check-in"
                description="Guests can join the queue without staff help."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="allowCustomerCancel"
            render={({ field }) => (
              <ToggleRow
                id="allowCustomerCancel"
                label="Allow customer cancellation"
                description="Guests can leave the queue on their own."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="requireCustomerName"
            render={({ field }) => (
              <ToggleRow
                id="requireCustomerName"
                label="Require customer name"
                description="Name is required when joining a queue."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="requireCustomerPhone"
            render={({ field }) => (
              <ToggleRow
                id="requireCustomerPhone"
                label="Require phone number"
                description="Phone is required when joining a queue."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </CardContent>
      </Card>

      <SettingsFormActions
        dirty={dirty}
        pending={pending}
        canManage={canManage}
        onCancel={() => form.reset()}
      />
    </form>
  );
}
