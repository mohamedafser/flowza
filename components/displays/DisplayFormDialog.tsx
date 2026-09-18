"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createDisplayAction,
  updateDisplayAction,
} from "@/app/actions/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_NEXT_TOKEN_COUNT,
  DISPLAY_NEXT_TOKEN_MAX,
  DISPLAY_NEXT_TOKEN_MIN,
  DISPLAY_THEMES,
  type DisplaySettings,
} from "@/lib/validations/display";
import type { DisplayListItem, DisplayQueueOption } from "@/services/displays";
import type { Branch } from "@/lib/context/restaurant";
import { z } from "zod";

const formSchema = z.object({
  branchId: z.string().uuid("Select a branch."),
  queueId: z.string().uuid("Select a queue."),
  name: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(80, "Display name is too long."),
  isActive: z.boolean(),
  nextTokenCount: z
    .number()
    .int()
    .min(DISPLAY_NEXT_TOKEN_MIN)
    .max(DISPLAY_NEXT_TOKEN_MAX),
  showRestaurantLogo: z.boolean(),
  showBranchName: z.boolean(),
  showQueueName: z.boolean(),
  theme: z.enum(DISPLAY_THEMES),
  preferFullscreen: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type DisplayFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  restaurantId: string;
  branches: Branch[];
  queues: DisplayQueueOption[];
  display?: DisplayListItem | null;
  canManage: boolean;
  onSaved?: () => void;
};

function defaultsFromDisplay(
  display: DisplayListItem | null | undefined,
  defaultBranchId: string | undefined,
  defaultQueueId: string | undefined,
): FormValues {
  const settings: DisplaySettings = display?.settings ?? {
    nextTokenCount: DEFAULT_NEXT_TOKEN_COUNT,
    showRestaurantLogo: true,
    showBranchName: true,
    showQueueName: true,
    theme: "dark",
    preferFullscreen: false,
  };

  return {
    branchId: display?.branch_id ?? defaultBranchId ?? "",
    queueId: display?.queue_id ?? defaultQueueId ?? "",
    name: display?.name ?? "",
    isActive: display?.is_active ?? true,
    nextTokenCount: settings.nextTokenCount,
    showRestaurantLogo: settings.showRestaurantLogo,
    showBranchName: settings.showBranchName,
    showQueueName: settings.showQueueName,
    theme: settings.theme,
    preferFullscreen: settings.preferFullscreen,
  };
}

export function DisplayFormDialog({
  open,
  onOpenChange,
  mode,
  restaurantId,
  branches,
  queues,
  display,
  canManage,
  onSaved,
}: DisplayFormDialogProps) {
  const [pending, setPending] = useState(false);
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.is_active),
    [branches],
  );
  const defaultBranchId = activeBranches[0]?.id;
  const defaultQueueId = queues.find(
    (queue) => queue.branch_id === defaultBranchId,
  )?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: defaultsFromDisplay(display, defaultBranchId, defaultQueueId),
  });

  const branchId = form.watch("branchId");
  const branchQueues = queues.filter((queue) => queue.branch_id === branchId);

  const onBranchChange = (nextBranchId: string) => {
    form.setValue("branchId", nextBranchId);
    const firstQueue = queues.find((queue) => queue.branch_id === nextBranchId);
    form.setValue("queueId", firstQueue?.id ?? "");
  };

  const isActive = form.watch("isActive");
  const theme = form.watch("theme");
  const queueId = form.watch("queueId");
  const showRestaurantLogo = form.watch("showRestaurantLogo");
  const showBranchName = form.watch("showBranchName");
  const showQueueName = form.watch("showQueueName");
  const preferFullscreen = form.watch("preferFullscreen");

  const settingSwitches = [
    {
      key: "showRestaurantLogo" as const,
      label: "Show restaurant logo",
      checked: showRestaurantLogo,
    },
    {
      key: "showBranchName" as const,
      label: "Show branch name",
      checked: showBranchName,
    },
    {
      key: "showQueueName" as const,
      label: "Show queue name",
      checked: showQueueName,
    },
    {
      key: "preferFullscreen" as const,
      label: "Suggest fullscreen on open",
      checked: preferFullscreen,
    },
  ];

  const onSubmit = form.handleSubmit(async (values) => {
    if (!canManage) return;
    setPending(true);
    try {
      const settings = {
        nextTokenCount: values.nextTokenCount,
        showRestaurantLogo: values.showRestaurantLogo,
        showBranchName: values.showBranchName,
        showQueueName: values.showQueueName,
        theme: values.theme,
        preferFullscreen: values.preferFullscreen,
      };

      if (mode === "create") {
        const result = await createDisplayAction({
          restaurantId,
          branchId: values.branchId,
          queueId: values.queueId,
          name: values.name,
          isActive: values.isActive,
          settings,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Unable to create display.");
          return;
        }
        toast.success("Display created.");
      } else if (display) {
        const result = await updateDisplayAction({
          displayId: display.id,
          branchId: values.branchId,
          queueId: values.queueId,
          name: values.name,
          isActive: values.isActive,
          settings,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Unable to update display.");
          return;
        }
        toast.success("Display updated.");
      }

      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  });

  const disabled = !canManage || pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create display" : "Edit display"}
          </DialogTitle>
          <DialogDescription>
            Configure a TV or monitor display for a branch queue. Customer names
            and contact details are never shown.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              disabled={disabled}
              {...form.register("name")}
              placeholder="Main Dining TV"
            />
            {form.formState.errors.name ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display-branch">Branch</Label>
            <Select
              id="display-branch"
              disabled={disabled}
              value={branchId}
              onChange={(event) => onBranchChange(event.target.value)}
            >
              <option value="" disabled>
                Select branch
              </option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display-queue">Queue</Label>
            <Select
              id="display-queue"
              disabled={disabled || branchQueues.length === 0}
              value={queueId}
              onChange={(event) => form.setValue("queueId", event.target.value)}
            >
              <option value="" disabled>
                {branchQueues.length === 0
                  ? "No queues for this branch"
                  : "Select queue"}
              </option>
              {branchQueues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="display-active">Active</Label>
              <p className="text-muted-foreground text-xs">
                Inactive displays show an unavailable screen.
              </p>
            </div>
            <Switch
              id="display-active"
              checked={isActive}
              onCheckedChange={(checked) => form.setValue("isActive", checked)}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display-next-count">Next tokens to show</Label>
            <Input
              id="display-next-count"
              type="number"
              min={DISPLAY_NEXT_TOKEN_MIN}
              max={DISPLAY_NEXT_TOKEN_MAX}
              disabled={disabled}
              {...form.register("nextTokenCount", { valueAsNumber: true })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display-theme">Theme</Label>
            <Select
              id="display-theme"
              disabled={disabled}
              value={theme}
              onChange={(event) =>
                form.setValue(
                  "theme",
                  event.target.value as FormValues["theme"],
                )
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </Select>
          </div>

          <div className="grid gap-3">
            {settingSwitches.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3"
              >
                <Label htmlFor={`display-${item.key}`}>{item.label}</Label>
                <Switch
                  id={`display-${item.key}`}
                  checked={item.checked}
                  onCheckedChange={(checked) =>
                    form.setValue(item.key, checked)
                  }
                  disabled={disabled}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={disabled}>
              {mode === "create" ? "Create display" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
