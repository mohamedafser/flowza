"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setBranchStatusRequest } from "@/lib/api/branches-client";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/lib/context/restaurant";

type BranchStatusControlsProps = {
  branch: Branch;
};

export function BranchStatusControls({ branch }: BranchStatusControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activate = async () => {
    setPending(true);
    try {
      const result = await setBranchStatusRequest(branch.id, true);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to activate branch.");
        return;
      }
      toast.success("Branch activated.");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const deactivate = async () => {
    setPending(true);
    try {
      const result = await setBranchStatusRequest(branch.id, false);
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to deactivate branch.");
        return;
      }
      toast.success("Branch deactivated.");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {branch.is_active ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          Deactivate branch
        </Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={activate}>
          Activate branch
        </Button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Deactivate branch?"
        description="This branch will no longer be selectable for day-to-day operations. Existing historical data is kept. You can activate it again later."
        confirmLabel="Deactivate"
        destructive
        loading={pending}
        onConfirm={deactivate}
      />
    </>
  );
}
