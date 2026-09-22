"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/api/admin-client";
import type { Enums, Tables } from "@/types/database";
import { toast } from "sonner";

type Props = {
  subscriptionId: string;
  restaurantName: string;
  status: Enums<"subscription_status">;
  cancelAtPeriodEnd: boolean;
  billingCycle: Enums<"billing_cycle">;
};

type PlanOption = Pick<Tables<"plans">, "id" | "code" | "name" | "is_active">;

export function AdminSubscriptionActions({
  subscriptionId,
  restaurantName,
  status,
  cancelAtPeriodEnd,
  billingCycle,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState("");
  const [nextBillingCycle, setNextBillingCycle] =
    useState<Enums<"billing_cycle">>(billingCycle);
  const [trialDays, setTrialDays] = useState("7");

  useEffect(() => {
    if (!changePlanOpen) return;
    void adminFetch<PlanOption[]>("/api/admin/plans").then((response) => {
      if (response.ok && response.data) {
        const active = response.data.filter((p) => p.is_active);
        setPlans(active);
        if (active[0]) {
          setPlanId((prev) => prev || active[0].id);
        }
      }
    });
  }, [changePlanOpen]);

  async function postAction(body: Record<string, unknown>, success: string) {
    setLoading(true);
    const response = await adminFetch(`/api/admin/subscriptions/${subscriptionId}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to update subscription.");
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  }

  const canCancel =
    !cancelAtPeriodEnd &&
    status !== "CANCELLED" &&
    status !== "EXPIRED";
  const canReactivate =
    cancelAtPeriodEnd || status === "CANCELLED";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canCancel ? (
          <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
            Cancel at period end
          </Button>
        ) : null}
        {canReactivate ? (
          <Button onClick={() => setConfirmReactivate(true)}>Reactivate</Button>
        ) : null}
        <Button variant="outline" onClick={() => setChangePlanOpen(true)}>
          Change plan
        </Button>
        <Button variant="outline" onClick={() => setExtendTrialOpen(true)}>
          Extend trial
        </Button>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel subscription?"
        description={`${restaurantName} will keep access until the current billing period ends.`}
        confirmLabel="Schedule cancellation"
        destructive
        loading={loading}
        onConfirm={async () => {
          const ok = await postAction(
            { action: "cancel" },
            "Cancellation scheduled.",
          );
          if (ok) setConfirmCancel(false);
        }}
      />

      <ConfirmDialog
        open={confirmReactivate}
        onOpenChange={setConfirmReactivate}
        title="Reactivate subscription?"
        description={`This restores billing for ${restaurantName}.`}
        confirmLabel="Reactivate"
        loading={loading}
        onConfirm={async () => {
          const ok = await postAction(
            { action: "reactivate" },
            "Subscription reactivated.",
          );
          if (ok) setConfirmReactivate(false);
        }}
      />

      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              Assign a different active plan for {restaurantName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-plan">Plan</Label>
              <Select
                id="sub-plan"
                aria-label="Select plan"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-billing">Billing cycle</Label>
              <Select
                id="sub-billing"
                aria-label="Billing cycle"
                value={nextBillingCycle}
                onChange={(event) =>
                  setNextBillingCycle(
                    event.target.value as Enums<"billing_cycle">,
                  )
                }
              >
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={loading || !planId}
              onClick={() =>
                void (async () => {
                  const ok = await postAction(
                    {
                      action: "change_plan",
                      planId,
                      billingCycle: nextBillingCycle,
                    },
                    "Plan updated.",
                  );
                  if (ok) setChangePlanOpen(false);
                })()
              }
            >
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extendTrialOpen} onOpenChange={setExtendTrialOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend trial</DialogTitle>
            <DialogDescription>
              Add trial days for {restaurantName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="trial-days">Days to add</Label>
            <Input
              id="trial-days"
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={(event) => setTrialDays(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={loading}
              onClick={() =>
                void (async () => {
                  const days = Number(trialDays);
                  if (!Number.isFinite(days) || days < 1) {
                    toast.error("Enter a valid number of days.");
                    return;
                  }
                  const ok = await postAction(
                    { action: "extend_trial", days },
                    "Trial extended.",
                  );
                  if (ok) setExtendTrialOpen(false);
                })()
              }
            >
              Extend trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
