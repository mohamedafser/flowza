"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { createQRCodeAction, updateQRCodeAction } from "@/app/actions/qr-code";
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
import type { Branch } from "@/lib/context/restaurant";
import type { QRCodeListItem, QRCodeQueueOption } from "@/services/qr-codes";

const formSchema = z.object({
  branchId: z.string().uuid("Select a branch."),
  queueId: z.string().uuid("Select a queue."),
  name: z
    .string()
    .trim()
    .min(1, "QR name is required.")
    .max(80, "QR name is too long."),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type QRFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  restaurantId: string;
  branches: Branch[];
  queues: QRCodeQueueOption[];
  qrCode?: QRCodeListItem | null;
  defaultBranchId?: string | null;
  canManage: boolean;
  onSaved?: () => void;
};

function defaultsFromQR(
  qrCode: QRCodeListItem | null | undefined,
  defaultBranchId: string | undefined,
  defaultQueueId: string | undefined,
): FormValues {
  return {
    branchId: qrCode?.branch_id ?? defaultBranchId ?? "",
    queueId: qrCode?.queue_id ?? defaultQueueId ?? "",
    name: qrCode?.name ?? "",
    isActive: qrCode?.is_active ?? true,
  };
}

export function QRFormDialog({
  open,
  onOpenChange,
  mode,
  restaurantId,
  branches,
  queues,
  qrCode,
  defaultBranchId,
  canManage,
  onSaved,
}: QRFormDialogProps) {
  const [pending, setPending] = useState(false);
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.is_active),
    [branches],
  );
  const preferredBranchId =
    defaultBranchId &&
    activeBranches.some((branch) => branch.id === defaultBranchId)
      ? defaultBranchId
      : activeBranches[0]?.id;
  const preferredQueueId = queues.find(
    (queue) => queue.branch_id === preferredBranchId,
  )?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: defaultsFromQR(qrCode, preferredBranchId, preferredQueueId),
  });

  const branchId = form.watch("branchId");
  const queueId = form.watch("queueId");
  const isActive = form.watch("isActive");
  const branchQueues = queues.filter((queue) => queue.branch_id === branchId);

  const destinationChanged =
    mode === "edit" &&
    qrCode &&
    (branchId !== qrCode.branch_id || queueId !== qrCode.queue_id);

  const onBranchChange = (nextBranchId: string) => {
    form.setValue("branchId", nextBranchId);
    const firstQueue = queues.find((queue) => queue.branch_id === nextBranchId);
    form.setValue("queueId", firstQueue?.id ?? "");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!canManage) return;
    setPending(true);
    try {
      if (mode === "create") {
        const result = await createQRCodeAction({
          restaurantId,
          branchId: values.branchId,
          queueId: values.queueId,
          name: values.name,
          isActive: values.isActive,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Unable to create QR code.");
          return;
        }
        toast.success("QR code created.");
      } else if (qrCode) {
        const result = await updateQRCodeAction({
          qrCodeId: qrCode.id,
          branchId: values.branchId,
          queueId: values.queueId,
          name: values.name,
          isActive: values.isActive,
        });
        if (!result.ok) {
          toast.error(result.message ?? "Unable to update QR code.");
          return;
        }
        toast.success("QR code updated.");
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
            {mode === "create" ? "Create QR code" : "Edit QR code"}
          </DialogTitle>
          <DialogDescription>
            Generate a printable QR that sends customers to the public queue
            join screen. Destination URLs are created by the app — arbitrary
            URLs are not allowed.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="qr-name">QR name</Label>
            <Input
              id="qr-name"
              disabled={disabled}
              {...form.register("name")}
              placeholder="Main Entrance"
            />
            {form.formState.errors.name ? (
              <p className="text-destructive text-xs">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="qr-branch">Branch</Label>
            <Select
              id="qr-branch"
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
            <Label htmlFor="qr-queue">Queue</Label>
            <Select
              id="qr-queue"
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

          {destinationChanged ? (
            <p
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
              role="status"
            >
              Changing the queue or branch will change where this QR code sends
              customers. Existing printed copies will use the updated
              destination.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="qr-active">Active</Label>
              <p className="text-muted-foreground text-xs">
                Inactive QR codes show an unavailable screen when scanned.
              </p>
            </div>
            <Switch
              id="qr-active"
              checked={isActive}
              onCheckedChange={(checked) => form.setValue("isActive", checked)}
              disabled={disabled}
            />
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
              {mode === "create" ? "Create QR code" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
