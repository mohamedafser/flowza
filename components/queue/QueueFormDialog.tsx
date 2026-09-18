"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Select } from "@/components/ui/select";
import {
  QUEUE_STATUSES,
  QUEUE_STATUS_LABELS,
  queueFieldsSchema,
  type QueueFormValues,
  type QueueStatus,
} from "@/lib/validations/queue";
import type { QueueDefaults, QueueRecord } from "@/services/queues";

type QueueFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  queue?: QueueRecord | null;
  defaults: QueueDefaults;
  pending: boolean;
  onSubmit: (values: QueueFormValues) => Promise<void> | void;
};

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  );
}

function toFormValues(
  defaults: QueueDefaults,
  queue?: QueueRecord | null,
): QueueFormValues {
  return {
    name: queue?.name ?? defaults.defaultQueueName,
    prefix: queue?.prefix ?? defaults.tokenPrefix,
    startingNumber: queue?.starting_number ?? defaults.startingTokenNumber,
    estimatedServiceMinutes:
      queue?.estimated_service_minutes ?? defaults.defaultServiceMinutes,
    status: queue?.status ?? "ACTIVE",
  };
}

export function QueueFormDialog({
  open,
  onOpenChange,
  mode,
  queue,
  defaults,
  pending,
  onSubmit,
}: QueueFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <QueueFormFields
            key={`${mode}:${queue?.id ?? "new"}`}
            mode={mode}
            queue={queue}
            defaults={defaults}
            pending={pending}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function QueueFormFields({
  mode,
  queue,
  defaults,
  pending,
  onSubmit,
  onCancel,
}: Omit<QueueFormDialogProps, "open" | "onOpenChange"> & {
  onCancel: () => void;
}) {
  const form = useForm<QueueFormValues>({
    resolver: zodResolver(queueFieldsSchema),
    defaultValues: toFormValues(defaults, queue),
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    if (pending) return;
    await onSubmit(values);
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create queue" : "Queue settings"}
        </DialogTitle>
        <DialogDescription>
          {mode === "create"
            ? "Uses restaurant defaults below. You can override them for this queue."
            : "Queue-specific values override restaurant defaults for this waitlist only."}
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
          Restaurant defaults: {defaults.defaultQueueName}, prefix{" "}
          {defaults.tokenPrefix}, start {defaults.startingTokenNumber},{" "}
          {defaults.defaultServiceMinutes} min service
          {defaults.maxQueueCapacity
            ? `, cap ${defaults.maxQueueCapacity}`
            : ""}
          .
        </div>
        <div className="space-y-2">
          <Label htmlFor="queue-name">
            Queue name <RequiredMark />
          </Label>
          <Input
            id="queue-name"
            disabled={pending}
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
            <Label htmlFor="queue-prefix">
              Token prefix <RequiredMark />
            </Label>
            <Input
              id="queue-prefix"
              maxLength={8}
              disabled={pending}
              {...form.register("prefix")}
            />
            {form.formState.errors.prefix ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.prefix.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="queue-start">
              Starting number <RequiredMark />
            </Label>
            <Input
              id="queue-start"
              type="number"
              min={1}
              disabled={pending}
              {...form.register("startingNumber")}
            />
            {form.formState.errors.startingNumber ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.startingNumber.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="queue-duration">
              Estimated service (minutes) <RequiredMark />
            </Label>
            <Input
              id="queue-duration"
              type="number"
              min={1}
              disabled={pending}
              {...form.register("estimatedServiceMinutes")}
            />
            {form.formState.errors.estimatedServiceMinutes ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.estimatedServiceMinutes.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="queue-status">Status</Label>
            <Select
              id="queue-status"
              disabled={pending}
              {...form.register("status")}
            >
              {QUEUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {QUEUE_STATUS_LABELS[status as QueueStatus]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Create queue"
                : "Save settings"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
