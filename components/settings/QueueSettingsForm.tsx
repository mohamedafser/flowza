"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateQueueSettingsRequest } from "@/lib/api/settings-client";
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
import { Switch } from "@/components/ui/switch";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  queueSettingsSchema,
  type QueueSettingsValues,
} from "@/lib/validations/settings";
import type { RestaurantSettings } from "@/services/settings";

type QueueSettingsFormProps = {
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

export function QueueSettingsForm({
  restaurantId,
  settings,
  canManage,
}: QueueSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<QueueSettingsValues>({
    resolver: zodResolver(queueSettingsSchema),
    defaultValues: {
      queueEnabled: settings.queue_enabled,
      defaultQueueName: settings.default_queue_name,
      tokenPrefix: settings.token_prefix,
      startingTokenNumber: settings.starting_token_number,
      defaultServiceMinutes: settings.default_service_minutes,
      maxQueueCapacity: settings.max_queue_capacity,
      allowWalkIns: settings.allow_walk_ins,
      allowSelfCheckIn: settings.allow_self_check_in,
      allowManualEntry: settings.allow_manual_entry,
      showEstimatedWait: settings.show_estimated_wait,
      showQueuePosition: settings.show_queue_position,
    },
  });

  const dirty = form.formState.isDirty;
  useUnsavedChanges(dirty && canManage);

  const onSubmit = form.handleSubmit((values) => {
    if (!canManage) return;
    startTransition(async () => {
      const result = await updateQueueSettingsRequest(restaurantId, values);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to save queue settings.");
        return;
      }
      toast.success("Queue settings updated.");
      form.reset(values);
      router.refresh();
    });
  });

  const disabled = !canManage || pending;

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Queue defaults</CardTitle>
          <CardDescription>
            Restaurant-wide defaults for new queues and daily token numbering.
            Live queues can override name, prefix, and service duration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={form.control}
            name="queueEnabled"
            render={({ field }) => (
              <ToggleRow
                id="queueEnabled"
                label="Queue enabled"
                description="Allow staff to operate waitlists for this restaurant."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultQueueName">Default queue name</Label>
              <Input
                id="defaultQueueName"
                disabled={disabled}
                {...form.register("defaultQueueName")}
              />
              {form.formState.errors.defaultQueueName ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.defaultQueueName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tokenPrefix">Token prefix</Label>
              <Input
                id="tokenPrefix"
                disabled={disabled}
                maxLength={8}
                {...form.register("tokenPrefix")}
              />
              {form.formState.errors.tokenPrefix ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.tokenPrefix.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startingTokenNumber">Starting token number</Label>
              <Input
                id="startingTokenNumber"
                type="number"
                min={1}
                disabled={disabled}
                {...form.register("startingTokenNumber")}
              />
              {form.formState.errors.startingTokenNumber ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.startingTokenNumber.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultServiceMinutes">
                Default service duration (minutes)
              </Label>
              <Input
                id="defaultServiceMinutes"
                type="number"
                min={1}
                disabled={disabled}
                {...form.register("defaultServiceMinutes")}
              />
              {form.formState.errors.defaultServiceMinutes ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.defaultServiceMinutes.message}
                </p>
              ) : null}
            </div>
          </div>

          <Controller
            control={form.control}
            name="maxQueueCapacity"
            render={({ field }) => (
              <div className="space-y-3">
                <ToggleRow
                  id="unlimitedCapacity"
                  label="Unlimited waiting capacity"
                  description="Turn off to cap how many customers can wait."
                  checked={field.value === null}
                  onCheckedChange={(checked) =>
                    field.onChange(checked ? null : 50)
                  }
                  disabled={disabled}
                />
                {field.value !== null ? (
                  <div className="space-y-2">
                    <Label htmlFor="maxQueueCapacity">Maximum capacity</Label>
                    <Input
                      id="maxQueueCapacity"
                      type="number"
                      min={1}
                      disabled={disabled}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        field.onChange(next === "" ? null : Number(next));
                      }}
                    />
                    {form.formState.errors.maxQueueCapacity ? (
                      <p className="text-destructive text-xs">
                        {form.formState.errors.maxQueueCapacity.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue operations</CardTitle>
          <CardDescription>
            Defaults for walk-ins, staff entry, and customer-visible wait
            information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={form.control}
            name="allowWalkIns"
            render={({ field }) => (
              <ToggleRow
                id="allowWalkIns"
                label="Allow walk-ins"
                description="Staff can add guests who arrive without a reservation."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="allowSelfCheckIn"
            render={({ field }) => (
              <ToggleRow
                id="allowSelfCheckIn"
                label="Allow customer self check-in"
                description="Customers can join the queue themselves when that screen is added."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="allowManualEntry"
            render={({ field }) => (
              <ToggleRow
                id="allowManualEntry"
                label="Allow staff to add customers"
                description="Staff can create queue entries on behalf of guests."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="showEstimatedWait"
            render={({ field }) => (
              <ToggleRow
                id="showEstimatedWait"
                label="Show estimated wait time"
                description="Display estimated wait on future staff and guest screens."
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
                id="showQueuePosition"
                label="Show queue position to customers"
                description="Let guests see how many parties are ahead."
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
