import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminRestaurantActions } from "@/components/admin/AdminRestaurantActions";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { adminBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { ADMIN_RESTAURANTS_PATH } from "@/lib/auth/paths";
import { getAdminRestaurantDetail } from "@/services/admin/admin-restaurants.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminRestaurantDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getAdminRestaurantDetail(id);
  if (!detail) notFound();

  const { restaurant, owner, branches, members, subscription, plan, usage, recentAudit } =
    detail;

  return (
    <div className="space-y-8">
      <PageHeader
        title={restaurant.name}
        description="Platform restaurant detail and support controls."
        breadcrumbs={adminBreadcrumbs(
          { label: "Restaurants", href: ADMIN_RESTAURANTS_PATH },
          { label: restaurant.name },
        )}
        actions={
          <AdminRestaurantActions
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            status={restaurant.status}
          />
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border-border space-y-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Restaurant</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <AdminStatusBadge status={restaurant.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(restaurant.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Contact</dt>
              <dd>{restaurant.phone ?? restaurant.email ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="border-border space-y-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Owner</h2>
          {owner ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  <Link
                    href={`/admin/users/${owner.id}`}
                    className="hover:underline"
                  >
                    {owner.fullName ?? "—"}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{owner.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Account</dt>
                <dd>
                  <AdminStatusBadge status={owner.accountStatus} />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">No owner found.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border-border rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">Branches</h2>
          <p className="mt-2 tabular-nums">
            {branches.total} total · {branches.active} active ·{" "}
            {branches.inactive} inactive
          </p>
        </div>
        <div className="border-border rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">Members</h2>
          <p className="mt-2 tabular-nums">{members.total} active</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {Object.entries(members.byRole)
              .map(([role, count]) => `${role}: ${count}`)
              .join(" · ") || "—"}
          </p>
        </div>
        <div className="border-border rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">Subscription</h2>
          <p className="mt-2">
            {plan?.name ?? subscription?.plan ?? "—"}{" "}
            <AdminStatusBadge status={subscription?.status} />
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {subscription?.billing_cycle ?? "—"} · trial ends{" "}
            {subscription?.trial_end
              ? new Date(subscription.trial_end).toLocaleDateString()
              : "—"}
          </p>
        </div>
      </section>

      {usage ? (
        <section className="border-border rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Usage</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>Branches: {usage.branches}</div>
            <div>Staff: {usage.staff}</div>
            <div>Tables: {usage.tables}</div>
            <div>Queue entries: {usage.queue_entries}</div>
            <div>Reservations: {usage.reservations}</div>
            <div>Displays: {usage.displays}</div>
          </div>
        </section>
      ) : null}

      <section className="border-border rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {recentAudit.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">No recent audit activity.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recentAudit.map((row) => (
              <li key={row.id} className="flex justify-between gap-4">
                <span>{row.action}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
