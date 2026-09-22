"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  MessageCircle,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react";
import { updateNotificationSettingsRequest } from "@/lib/api/settings-client";
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
  notificationSettingsSchema,
  type NotificationSettingsValues,
} from "@/lib/validations/notifications";
import type { RestaurantSettings } from "@/services/settings";
import type { NotificationProviderStatus } from "@/lib/notifications/provider-status";

type NotificationSettingsFormProps = {
  restaurantId: string;
  settings: RestaurantSettings;
  canManage: boolean;
  providerStatus: NotificationProviderStatus;
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  icon,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="flex items-center gap-2">
          {icon ? (
            <span className="text-muted-foreground [&_svg]:size-3.5">
              {icon}
            </span>
          ) : null}
          {label}
        </Label>
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

export function NotificationSettingsForm({
  restaurantId,
  settings,
  canManage,
  providerStatus,
}: NotificationSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      notificationsEmailEnabled: settings.notifications_email_enabled,
      notificationsWhatsappEnabled: settings.notifications_whatsapp_enabled,
      notificationsSmsEnabled: settings.notifications_sms_enabled,
      notificationsInAppEnabled: settings.notifications_in_app_enabled,
      notifyCustomerOnJoin: settings.notify_customer_on_join,
      notifyCustomerOnCalled: settings.notify_customer_on_called,
      notifyCustomerOnReminder: settings.notify_customer_on_reminder,
      notifyStaffOnJoin: settings.notify_staff_on_join,
      notifyStaffOnCancel: settings.notify_staff_on_cancel,
      notifyStaffOnNoShow: settings.notify_staff_on_no_show,
      notifyStaffQueueBusyThreshold:
        settings.notify_staff_queue_busy_threshold,
    },
  });

  useUnsavedChanges(form.formState.isDirty && !pending);

  function onSubmit(values: NotificationSettingsValues) {
    startTransition(async () => {
      const result = await updateNotificationSettingsRequest(
        restaurantId,
        values,
      );
      if (!result.ok) {
        toast.error(result.message ?? "Unable to save notification settings.");
        return;
      }
      toast.success("Notification settings updated.");
      form.reset(values);
      router.refresh();
    });
  }

  const disabled = !canManage || pending;

  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="text-muted-foreground size-4" />
            Channels
          </CardTitle>
          <CardDescription>
            Enable delivery channels for this restaurant. Provider credentials
            are configured on the server — they never appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="bg-muted/50 space-y-2 rounded-lg px-3 py-3 text-sm">
            <li>
              <span className="font-medium">Email:</span>{" "}
              <span className="text-muted-foreground">
                {providerStatus.email.label}
              </span>
            </li>
            <li>
              <span className="font-medium">WhatsApp:</span>{" "}
              <span className="text-muted-foreground">
                {providerStatus.whatsapp.label}
              </span>
            </li>
            <li>
              <span className="font-medium">In-app:</span>{" "}
              <span className="text-muted-foreground">
                {providerStatus.inApp.label}
              </span>
            </li>
            <li>
              <span className="font-medium">Web Push:</span>{" "}
              <span className="text-muted-foreground">
                {providerStatus.push.label}
              </span>
            </li>
          </ul>
          <Controller
            control={form.control}
            name="notificationsEmailEnabled"
            render={({ field }) => (
              <ToggleRow
                id="notificationsEmailEnabled"
                label="Email"
                description={
                  providerStatus.email.configured
                    ? "Send queue updates by email when a guest has an email on file."
                    : "Blocked until SMTP_* or RESEND_* is configured on the server."
                }
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled || !providerStatus.email.configured}
                icon={<Mail />}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notificationsWhatsappEnabled"
            render={({ field }) => (
              <ToggleRow
                id="notificationsWhatsappEnabled"
                label="WhatsApp"
                description={
                  providerStatus.whatsapp.configured
                    ? "Send WhatsApp messages when a guest has a phone number."
                    : "Blocked until WhatsApp Cloud API credentials are configured."
                }
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled || !providerStatus.whatsapp.configured}
                icon={<MessageCircle />}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notificationsSmsEnabled"
            render={({ field }) => (
              <ToggleRow
                id="notificationsSmsEnabled"
                label="SMS"
                description={
                  providerStatus.sms.configured
                    ? "Send SMS when a guest has a phone number."
                    : "Blocked until an SMS provider is configured."
                }
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled || !providerStatus.sms.configured}
                icon={<Smartphone />}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notificationsInAppEnabled"
            render={({ field }) => (
              <ToggleRow
                id="notificationsInAppEnabled"
                label="In-app"
                description="Show staff alerts in the dashboard notification bell for join, call, seat, cancel, and no-show."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                icon={<Bell />}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="text-muted-foreground size-4" />
            Customer notifications
          </CardTitle>
          <CardDescription>
            Defaults for guest queue messages. Guests can still opt out per
            channel when preferences are set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={form.control}
            name="notifyCustomerOnJoin"
            render={({ field }) => (
              <ToggleRow
                id="notifyCustomerOnJoin"
                label="Queue confirmation"
                description="Notify guests when they join the queue."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notifyCustomerOnCalled"
            render={({ field }) => (
              <ToggleRow
                id="notifyCustomerOnCalled"
                label="Table ready / seated"
                description="Notify guests when they are called or seated."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notifyCustomerOnReminder"
            render={({ field }) => (
              <ToggleRow
                id="notifyCustomerOnReminder"
                label="Upcoming turn reminder"
                description="Optional reminder before a guest is called (scheduled jobs later)."
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
          <CardTitle className="flex items-center gap-2">
            <Users className="text-muted-foreground size-4" />
            Staff notifications
          </CardTitle>
          <CardDescription>
            In-app alerts for the dashboard. Kept intentionally light.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={form.control}
            name="notifyStaffOnJoin"
            render={({ field }) => (
              <ToggleRow
                id="notifyStaffOnJoin"
                label="New guest joined"
                description="Alert staff when someone joins the queue."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notifyStaffOnCancel"
            render={({ field }) => (
              <ToggleRow
                id="notifyStaffOnCancel"
                label="Guest cancelled"
                description="Alert staff when a guest cancels."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notifyStaffOnNoShow"
            render={({ field }) => (
              <ToggleRow
                id="notifyStaffOnNoShow"
                label="Guest no-show"
                description="Alert staff when a guest is marked no-show."
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <div className="space-y-2">
            <Label htmlFor="notifyStaffQueueBusyThreshold">
              Busy threshold
            </Label>
            <p className="text-muted-foreground text-sm">
              Optional waiting-party count that triggers a one-time busy alert.
              Leave empty to disable.
            </p>
            <Input
              id="notifyStaffQueueBusyThreshold"
              type="number"
              min={1}
              disabled={disabled}
              placeholder="e.g. 10"
              {...form.register("notifyStaffQueueBusyThreshold", {
                setValueAs: (value: string) => {
                  if (value === "" || value == null) return null;
                  const n = Number(value);
                  return Number.isFinite(n) ? n : null;
                },
              })}
            />
            {form.formState.errors.notifyStaffQueueBusyThreshold ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.notifyStaffQueueBusyThreshold.message}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <SettingsFormActions
        canManage={canManage}
        pending={pending}
        dirty={form.formState.isDirty}
        onCancel={() => form.reset()}
      />
    </form>
  );
}
