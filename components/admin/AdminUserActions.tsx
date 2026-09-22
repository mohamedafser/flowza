"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/api/admin-client";
import type { Enums } from "@/types/database";
import { toast } from "sonner";

type Props = {
  userId: string;
  displayName: string;
  accountStatus: Enums<"account_status">;
};

export function AdminUserActions({
  userId,
  displayName,
  accountStatus,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const nextStatus: Enums<"account_status"> =
    accountStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";

  async function confirm() {
    setLoading(true);
    const response = await adminFetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ accountStatus: nextStatus }),
    });
    setLoading(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to update user.");
      return;
    }
    toast.success(
      nextStatus === "DISABLED" ? "User account disabled." : "User account re-enabled.",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant={nextStatus === "DISABLED" ? "destructive" : "default"}
        onClick={() => setOpen(true)}
      >
        {nextStatus === "DISABLED" ? "Disable account" : "Re-enable account"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          nextStatus === "DISABLED"
            ? "Disable user account?"
            : "Re-enable user account?"
        }
        description={
          nextStatus === "DISABLED"
            ? `${displayName} will be signed out and cannot access Flowza until re-enabled.`
            : `This will restore sign-in access for ${displayName}.`
        }
        confirmLabel={nextStatus === "DISABLED" ? "Disable account" : "Re-enable"}
        destructive={nextStatus === "DISABLED"}
        loading={loading}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
