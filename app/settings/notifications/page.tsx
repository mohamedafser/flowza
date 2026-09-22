import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/common/AccessDenied";
import { PageHeader } from "@/components/common/PageHeader";
import { NotificationSettingsForm } from "@/components/settings/NotificationSettingsForm";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_NOTIFICATIONS_PATH } from "@/lib/auth/paths";
import { SETTINGS_NOTIFICATIONS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getRestaurantSettings } from "@/services/settings";
import { getNotificationProviderStatus } from "@/lib/notifications/provider-status";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationSettingsPage() {
  const workspace = await requireWorkspacePage();

  if (!canAccessHref(workspace.role, SETTINGS_NOTIFICATIONS_PATH)) {
    return (
      <AccessDenied
        title="Notifications"
        description="Configure queue notification channels and defaults. Provider API keys stay on the server."
        breadcrumbs={SETTINGS_NOTIFICATIONS_BREADCRUMBS}
      />
    );
  }

  const settings = await getRestaurantSettings(workspace.restaurant!.id);

  if (!settings) {
    notFound();
  }

  const providerStatus = getNotificationProviderStatus();

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
        providerStatus={providerStatus}
      />
    </div>
  );
}
