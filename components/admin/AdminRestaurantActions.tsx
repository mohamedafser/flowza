"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/api/admin-client";
import type { Enums } from "@/types/database";
import { toast } from "sonner";

type Props = {
  restaurantId: string;
  restaurantName: string;
  status: Enums<"restaurant_status">;
};

export function AdminRestaurantActions({
  restaurantId,
  restaurantName,
  status,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const nextStatus: Enums<"restaurant_status"> =
    status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  async function confirm() {
    setLoading(true);
    const response = await adminFetch(`/api/admin/restaurants/${restaurantId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    setLoading(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to update restaurant.");
      return;
    }
    toast.success(
      nextStatus === "ACTIVE" ? "Restaurant reactivated." : "Restaurant suspended.",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant={nextStatus === "SUSPENDED" ? "destructive" : "default"}
        onClick={() => setOpen(true)}
      >
        {nextStatus === "SUSPENDED" ? "Suspend" : "Reactivate"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          nextStatus === "SUSPENDED"
            ? "Suspend restaurant?"
            : "Reactivate restaurant?"
        }
        description={
          nextStatus === "SUSPENDED"
            ? `This will prevent users from accessing ${restaurantName}. Existing data remains intact.`
            : `This will restore access to ${restaurantName}.`
        }
        confirmLabel={
          nextStatus === "SUSPENDED" ? "Suspend restaurant" : "Reactivate"
        }
        destructive={nextStatus === "SUSPENDED"}
        loading={loading}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
