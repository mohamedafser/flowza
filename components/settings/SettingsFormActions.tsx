"use client";

import { Button } from "@/components/ui/button";

type SettingsFormActionsProps = {
  dirty: boolean;
  pending: boolean;
  canManage: boolean;
  onCancel: () => void;
  saveLabel?: string;
};

export function SettingsFormActions({
  dirty,
  pending,
  canManage,
  onCancel,
  saveLabel = "Save changes",
}: SettingsFormActionsProps) {
  if (!canManage) {
    return (
      <p className="text-muted-foreground text-sm">
        You can view these settings. Editing requires the restaurant.manage
        permission.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Saving…" : saveLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={pending || !dirty}
      >
        Cancel
      </Button>
    </div>
  );
}
