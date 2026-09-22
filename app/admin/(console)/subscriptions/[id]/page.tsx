import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSubscriptionActions } from "@/components/admin/AdminSubscriptionActions";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { adminBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import {
  ADMIN_RESTAURANTS_PATH,
  ADMIN_SUBSCRIPTIONS_PATH,
} from "@/lib/auth/paths";
import { getAdminSubscriptionDetail } from "@/services/admin/admin-subscriptions.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default async function AdminSubscriptionDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getAdminSubscriptionDetail(id);
  if (!detail) notFound();

  const { subscription, restaurant, plan, payments } = detail;
  const title = `${restaurant.name} subscription`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        description="Subscription billing detail and support actions."
        breadcrumbs={adminBreadcrumbs(
          { label: "Subscriptions", href: ADMIN_SUBSCRIPTIONS_PATH },
          { label: restaurant.name },
        )}
        actions={
          <AdminSubscriptionActions
            subscriptionId={subscription.id}
            restaurantName={restaurant.name}
            status={subscription.status}
            cancelAtPeriodEnd={subscription.cancel_at_period_end}
            billingCycle={subscription.billing_cycle}
          />
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border-border space-y-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Subscription</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <AdminStatusBadge status={subscription.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Plan</dt>
              <dd>{plan?.name ?? subscription.plan ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Billing cycle</dt>
              <dd>{subscription.billing_cycle}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cancel at period end</dt>
              <dd>{subscription.cancel_at_period_end ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Period</dt>
              <dd className="text-right">
                {subscription.current_period_start
                  ? new Date(subscription.current_period_start).toLocaleDateString()
                  : "—"}{" "}
                –{" "}
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Trial end</dt>
              <dd>
                {subscription.trial_end
                  ? new Date(subscription.trial_end).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-border space-y-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Restaurant & provider</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Restaurant</dt>
              <dd>
                <Link
                  href={`${ADMIN_RESTAURANTS_PATH}/${restaurant.id}`}
                  className="hover:underline"
                >
                  {restaurant.name}
                </Link>{" "}
                <AdminStatusBadge status={restaurant.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider</dt>
              <dd>{subscription.provider ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider customer ID</dt>
              <dd className="font-mono text-xs break-all">
                {subscription.provider_customer_id ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider subscription ID</dt>
              <dd className="font-mono text-xs break-all">
                {subscription.provider_subscription_id ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-border rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Recent payments</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">No payments recorded.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Provider payment ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-border border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(payment.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMoney(Number(payment.amount), payment.currency)}
                    </td>
                    <td className="py-2 pr-3">
                      <AdminStatusBadge status={payment.status} />
                    </td>
                    <td className="py-2 font-mono text-xs break-all">
                      {payment.provider_payment_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
