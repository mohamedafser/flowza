import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { NotificationSettingsForm } from "@/components/settings/NotificationSettingsForm";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_NOTIFICATIONS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getRestaurantSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationSettingsPage() {
  const workspace = await requireWorkspacePage();
  const settings = await getRestaurantSettings(workspace.restaurant!.id);

  if (!settings) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Configure queue notification channels and defaults. Provider API keys stay on the server."
        breadcrumbs={SETTINGS_NOTIFICATIONS_BREADCRUMBS}
      />
      <NotificationSettingsForm
        restaurantId={workspace.restaurant!.id}
        settings={settings}
        canManage={workspace.canManageRestaurant}
      />
    </div>
  );
}
