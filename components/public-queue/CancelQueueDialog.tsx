"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";

type CancelQueueDialogProps = {
  disabled?: boolean;
  pending?: boolean;
  onConfirm: () => Promise<void> | void;
};

export function CancelQueueDialog({
  disabled,
  pending,
  onConfirm,
}: CancelQueueDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-base"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
      >
        Cancel queue entry
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel your queue entry?"
        description="You will lose this place in line. You can join again later if the queue is still open."
        confirmLabel="Cancel entry"
        cancelLabel="Keep my place"
        destructive
        loading={pending}
        onConfirm={async () => {
          await onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
}
