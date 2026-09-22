"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasPermission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";
import type {
  BillingCycle,
  BillingOverview,
  CheckoutSession,
  PlanRecord,
  UsageMeter,
} from "@/lib/billing/types";
import { cn } from "@/lib/utils";

type BillingScreenProps = {
  restaurantId: string;
  role: MemberRole;
  initialOverview: BillingOverview;
};

type RazorpayCheckoutHandler = {
  open: () => void;
  on: (event: string, handler: (response: RazorpaySuccessResponse) => void) => void;
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutHandler;
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusTone(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
    case "SUCCESS":
      return "default";
    case "TRIALING":
      return "secondary";
    case "PAST_DUE":
    case "FAILED":
    case "EXPIRED":
      return "destructive";
    default:
      return "outline";
  }
}

function UsageMeterRow({ meter }: { meter: UsageMeter }) {
  const limitLabel = meter.unlimited
    ? "Unlimited"
    : meter.limit === null
      ? "—"
      : String(meter.limit);
  const ratio =
    meter.unlimited || !meter.limit || meter.limit <= 0
      ? meter.current > 0
        ? 1
        : 0
      : Math.min(1, meter.current / meter.limit);
  const atLimit = !meter.unlimited && meter.limit !== null && meter.current >= meter.limit;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{meter.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {meter.current} / {limitLabel}
        </span>
      </div>
      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${meter.label} usage`}
        aria-valuemin={0}
        aria-valuemax={meter.unlimited ? undefined : meter.limit ?? undefined}
        aria-valuenow={meter.current}
        aria-valuetext={`${meter.current} of ${limitLabel}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            atLimit ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-razorpay="checkout"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "checkout";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BillingScreen({
  restaurantId,
  role,
  initialOverview,
}: BillingScreenProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    initialOverview.subscription?.billing_cycle ?? "MONTHLY",
  );
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cycleGroupId = useId();
  const canManage = hasPermission(role, "billing.manage");

  async function refreshOverview() {
    const response = await fetch(
      `/api/billing?restaurantId=${encodeURIComponent(restaurantId)}`,
      { cache: "no-store" },
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: BillingOverview;
      message?: string;
    };
    if (json.ok && json.data) {
      setOverview(json.data);
    }
  }

  async function startCheckout(plan: PlanRecord) {
    if (!canManage || pendingPlan) return;
    setPendingPlan(plan.code);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          planCode: plan.code,
          billingCycle,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        data?: CheckoutSession;
        message?: string;
      };

      if (!json.ok || !json.data) {
        toast.error(json.message ?? "Unable to start checkout.");
        return;
      }

      if (!json.data.providerSubscriptionId || plan.monthly_price <= 0) {
        toast.success(`Switched to the ${plan.name} plan.`);
        await refreshOverview();
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast.error("Unable to open the payment window. Please try again.");
        return;
      }

      const checkout = new window.Razorpay({
        key: json.data.keyId,
        subscription_id: json.data.providerSubscriptionId,
        name: "Flowza",
        description: json.data.description,
        notes: json.data.notes,
        theme: { color: "#0f172a" },
        handler: async (payment: RazorpaySuccessResponse) => {
          const verifyResponse = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId,
              planCode: plan.code,
              billingCycle,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySubscriptionId: payment.razorpay_subscription_id,
              razorpaySignature: payment.razorpay_signature,
            }),
          });
          const verifyJson = (await verifyResponse.json()) as {
            ok: boolean;
            message?: string;
          };
          if (!verifyJson.ok) {
            toast.error(verifyJson.message ?? "Payment verification failed.");
            return;
          }
          toast.success(`You're now on the ${plan.name} plan.`);
          await refreshOverview();
        },
      });

      checkout.on("payment.failed", () => {
        toast.error("Payment failed. You can try again when ready.");
      });
      checkout.open();
    } catch {
      toast.error("Unable to start checkout. Please try again.");
    } finally {
      setPendingPlan(null);
    }
  }

  function runCancel() {
    startTransition(async () => {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        toast.error(json.message ?? "Unable to cancel subscription.");
        return;
      }
      setCancelOpen(false);
      toast.success("Cancellation scheduled for the end of the billing period.");
      await refreshOverview();
    });
  }

  function runReactivate() {
    startTransition(async () => {
      const response = await fetch("/api/billing/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!json.ok) {
        toast.error(json.message ?? "Unable to reactivate subscription.");
        return;
      }
      toast.success("Subscription reactivated.");
      await refreshOverview();
    });
  }

  const currentPlanCode = overview.plan?.code ?? null;
  const busy = isPending || pendingPlan !== null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="current-plan-heading" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="current-plan-heading" className="text-lg font-semibold">
              Current plan
            </h2>
            <p className="text-muted-foreground text-sm">
              Restaurant-level subscription and billing period.
            </p>
          </div>
          <Badge variant={statusTone(String(overview.status))}>
            {overview.status}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{overview.plan?.name ?? "No plan selected"}</CardTitle>
            <CardDescription>
              {overview.plan?.description ??
                "Choose a plan below to activate billing for this restaurant."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Billing cycle</dt>
              <dd className="font-medium">
                {overview.subscription?.billing_cycle ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current price</dt>
              <dd className="font-medium">
                {overview.currentPrice == null
                  ? "—"
                  : formatMoney(overview.currentPrice, overview.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Renewal / period end</dt>
              <dd className="font-medium">
                {formatDate(overview.subscription?.current_period_end)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Trial</dt>
              <dd className="font-medium">
                {overview.isTrialing
                  ? overview.trialDaysRemaining == null
                    ? "In trial"
                    : `${overview.trialDaysRemaining} day${overview.trialDaysRemaining === 1 ? "" : "s"} remaining`
                  : "Not in trial"}
              </dd>
            </div>
          </CardContent>
          {canManage ? (
            <CardFooter className="flex flex-wrap gap-2">
              {overview.cancelAtPeriodEnd ? (
                <>
                  <p className="text-muted-foreground w-full text-sm">
                    Your subscription will remain active until{" "}
                    {formatDate(overview.subscription?.current_period_end)}.
                  </p>
                  <Button
                    type="button"
                    onClick={runReactivate}
                    disabled={busy}
                  >
                    Reactivate subscription
                  </Button>
                </>
              ) : overview.plan && overview.plan.code !== "FREE" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  disabled={busy}
                >
                  Cancel subscription
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>

        {overview.status === "PAST_DUE" ? (
          <Alert variant="destructive" title="Billing issue">
            The latest payment failed. Update payment details with your payment
            provider, then retry from the plan cards below.
          </Alert>
        ) : null}

        {overview.status === "EXPIRED" || overview.status === "CANCELLED" ? (
          <Alert title="Subscription ended">
            Choose a plan below to restore full access. Existing restaurant data
            is kept.
          </Alert>
        ) : null}
      </section>

      <section aria-labelledby="usage-heading" className="space-y-4">
        <div>
          <h2 id="usage-heading" className="text-lg font-semibold">
            Usage
          </h2>
          <p className="text-muted-foreground text-sm">
            Counts for the current billing period where monthly limits apply.
          </p>
        </div>
        <Card>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
            {overview.meters.map((meter) => (
              <UsageMeterRow key={meter.resource} meter={meter} />
            ))}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="plans-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="plans-heading" className="text-lg font-semibold">
              Plans
            </h2>
            <p className="text-muted-foreground text-sm">
              Prices come from your subscription catalog.
            </p>
          </div>
          <div
            role="group"
            aria-labelledby={cycleGroupId}
            className="bg-muted inline-flex rounded-lg p-1"
          >
            <span id={cycleGroupId} className="sr-only">
              Billing cycle
            </span>
            {(["MONTHLY", "YEARLY"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  billingCycle === cycle
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={billingCycle === cycle}
                onClick={() => setBillingCycle(cycle)}
              >
                {cycle === "MONTHLY" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {overview.plans.map((plan) => {
            const price =
              billingCycle === "YEARLY" ? plan.yearly_price : plan.monthly_price;
            const isCurrent = currentPlanCode === plan.code;
            const featureEntries = Object.entries(plan.features).filter(
              ([, enabled]) => enabled,
            );

            return (
              <Card
                key={plan.id}
                className={cn(isCurrent && "ring-primary/40 ring-2")}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent ? <Badge>Current</Badge> : null}
                  </div>
                  <CardDescription>
                    {plan.description ?? "Configurable subscription plan."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatMoney(price, plan.currency)}
                    <span className="text-muted-foreground text-sm font-normal">
                      /{billingCycle === "YEARLY" ? "year" : "month"}
                    </span>
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>
                      {plan.limits.max_branches} branch
                      {plan.limits.max_branches === 1 ? "" : "es"}
                    </li>
                    <li>{plan.limits.max_staff} staff</li>
                    <li>{plan.limits.max_tables} tables</li>
                    <li>
                      {plan.limits.max_queue_entries_per_month.toLocaleString()}{" "}
                      queue entries / month
                    </li>
                    {featureEntries.slice(0, 6).map(([key]) => (
                      <li key={key}>{key.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {canManage ? (
                    <Button
                      type="button"
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={busy || (isCurrent && !overview.isExpired)}
                      aria-busy={pendingPlan === plan.code}
                      onClick={() => startCheckout(plan)}
                    >
                      {pendingPlan === plan.code
                        ? "Working…"
                        : isCurrent
                          ? "Current plan"
                          : price <= 0
                            ? "Switch to Free"
                            : "Upgrade"}
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Only owners can change plans.
                    </p>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
        {!overview.providerConfigured && canManage ? (
          <p className="text-muted-foreground text-sm">
            Razorpay is not configured yet. Free plan switches still work;
            paid checkout requires server keys.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="payments-heading" className="space-y-4">
        <div>
          <h2 id="payments-heading" className="text-lg font-semibold">
            Payment history
          </h2>
          <p className="text-muted-foreground text-sm">
            Provider references only — card details are never stored.
          </p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto pt-4">
            {overview.payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No payments yet.
              </p>
            ) : (
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Provider</th>
                    <th className="py-2 font-medium">Invoice / reference</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-border/70 border-b last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        {formatDate(payment.paid_at ?? payment.created_at)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">
                        {formatMoney(Number(payment.amount), payment.currency)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={statusTone(payment.status)}>
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        {payment.provider ?? "—"}
                      </td>
                      <td className="py-2.5 font-mono text-xs">
                        {payment.invoice_number ||
                          payment.provider_invoice_id ||
                          payment.provider_payment_id ||
                          "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              Access continues until{" "}
              {formatDate(overview.subscription?.current_period_end)}. You can
              reactivate before then.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={busy}
            >
              Keep plan
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={runCancel}
              disabled={busy}
            >
              Cancel at period end
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
