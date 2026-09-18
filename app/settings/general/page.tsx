import type { Metadata } from "next";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_GENERAL_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getRestaurantSettings } from "@/services/settings";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "General settings",
};

export default async function GeneralSettingsPage() {
  const workspace = await requireWorkspacePage();
  const restaurant = workspace.restaurant!;
  const settings = await getRestaurantSettings(restaurant.id);

  if (!settings) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="General"
        description="Restaurant identity, contact details, currency, timezone, and date formats."
        breadcrumbs={SETTINGS_GENERAL_BREADCRUMBS}
        actions={
          <StatusBadge
            label={restaurant.status}
            tone={
              restaurant.status === "ACTIVE"
                ? "success"
                : restaurant.status === "SUSPENDED"
                  ? "danger"
                  : "warning"
            }
          />
        }
      />

      <dl className="mb-8 grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="font-medium">
            {new Date(restaurant.created_at).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Slug</dt>
          <dd className="font-medium">{restaurant.slug}</dd>
        </div>
      </dl>

      <GeneralSettingsForm
        restaurant={restaurant}
        settings={settings}
        canManage={workspace.canManageRestaurant}
      />
    </div>
  );
}
