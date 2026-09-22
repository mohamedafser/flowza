import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { adminBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { ADMIN_RESTAURANTS_PATH, ADMIN_USERS_PATH } from "@/lib/auth/paths";
import { getAdminUserDetail } from "@/services/admin/admin-users.service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getAdminUserDetail(id);
  if (!detail) notFound();

  const { profile, email, emailVerified, lastSignInAt, memberships, recentAudit } =
    detail;
  const displayName = profile.full_name ?? email ?? "User";

  return (
    <div className="space-y-8">
      <PageHeader
        title={displayName}
        description="Platform user profile and memberships."
        breadcrumbs={adminBreadcrumbs(
          { label: "Users", href: ADMIN_USERS_PATH },
          { label: displayName },
        )}
        actions={
          <AdminUserActions
            userId={profile.id}
            displayName={displayName}
            accountStatus={profile.account_status}
          />
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border-border space-y-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Profile</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Account status</dt>
              <dd>
                <AdminStatusBadge status={profile.account_status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email verified</dt>
              <dd>{emailVerified ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Platform role</dt>
              <dd>{profile.platform_role ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(profile.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd>
                {lastSignInAt
                  ? new Date(lastSignInAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-border space-y-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Memberships</h2>
          {memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">No restaurant memberships.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {memberships.map((row) => (
                <li
                  key={`${row.restaurantId}-${row.role}`}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <Link
                    href={`${ADMIN_RESTAURANTS_PATH}/${row.restaurantId}`}
                    className="font-medium hover:underline"
                  >
                    {row.restaurantName}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {row.role} · <AdminStatusBadge status={row.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="border-border rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {recentAudit.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">No recent audit activity.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recentAudit.map((row) => (
              <li key={row.id} className="flex justify-between gap-4">
                <span>
                  {row.action}{" "}
                  <span className="text-muted-foreground">({row.entityType})</span>
                </span>
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
