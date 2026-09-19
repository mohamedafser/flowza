import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Building2,
  Clock3,
  LayoutGrid,
  ListOrdered,
  Settings2,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { requireWorkspacePage } from "@/lib/context/workspace";
import {
  SETTINGS_BRANCHES_PATH,
  SETTINGS_CUSTOMER_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_HOURS_PATH,
  SETTINGS_NOTIFICATIONS_PATH,
  SETTINGS_QUEUE_PATH,
  SETTINGS_TABLES_PATH,
} from "@/lib/auth/paths";
import { SETTINGS_HOME_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const workspace = await requireWorkspacePage();
  const { auth, restaurant, role, canManageRestaurant } = workspace;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage restaurant, hours, queue defaults, appearance, and account preferences."
        breadcrumbs={SETTINGS_HOME_BREADCRUMBS}
      />

      <div className="space-y-10">
        <section className="max-w-lg space-y-3">
          <div>
            <h2 className="text-sm font-medium">Restaurant</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure restaurant details and locations for{" "}
              <span className="text-foreground font-medium">
                {restaurant?.name}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link href={SETTINGS_GENERAL_PATH} />}
              nativeButton={false}
            >
              <Settings2 />
              General
            </Button>
            <Button
              variant="outline"
              render={<Link href={SETTINGS_BRANCHES_PATH} />}
              nativeButton={false}
            >
              <Building2 />
              Branches
            </Button>
            <Button
              variant="outline"
              render={<Link href={SETTINGS_HOURS_PATH} />}
              nativeButton={false}
            >
              <Clock3 />
              Operating hours
            </Button>
            <Button
              variant="outline"
              render={<Link href={SETTINGS_TABLES_PATH} />}
              nativeButton={false}
            >
              <LayoutGrid />
              Table sections
            </Button>
            <Button
              variant="outline"
              render={<Link href={SETTINGS_QUEUE_PATH} />}
              nativeButton={false}
            >
              <ListOrdered />
              Queue
            </Button>
            <Button
              variant="outline"
              render={<Link href={SETTINGS_CUSTOMER_PATH} />}
              nativeButton={false}
            >
              <Users />
              Customer experience
            </Button>
            <Button
              variant="outline"
              render={<Link href={SETTINGS_NOTIFICATIONS_PATH} />}
              nativeButton={false}
            >
              <Bell />
              Notifications
            </Button>
          </div>
          {canManageRestaurant ? null : (
            <p className="text-muted-foreground text-xs">
              Your role ({role}) can view settings. Configuration changes
              require restaurant.manage.
            </p>
          )}
        </section>

        <section className="max-w-md space-y-3">
          <div>
            <h2 className="text-sm font-medium">Account</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Signed in account details for this device.
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{auth.profile?.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium break-all">
                {auth.user.email || "—"}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                {role ? (
                  <StatusBadge label={role} tone="info" />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Memberships</dt>
              <dd>
                <ul className="mt-1 space-y-1">
                  {auth.memberships.map((membership) => (
                    <li
                      key={membership.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="font-medium">
                        {membership.restaurant.name}
                      </span>
                      <StatusBadge label={membership.role} tone="info" />
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <LogoutButton />
        </section>

        <section className="max-w-md space-y-3">
          <div>
            <h2 className="text-sm font-medium">Appearance</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose light, dark, or match your system setting.
            </p>
          </div>
          <ThemeToggle variant="segmented" />
        </section>
      </div>
    </div>
  );
}
