import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { QueueSettingsForm } from "@/components/settings/QueueSettingsForm";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_QUEUE_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getRestaurantSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Queue settings",
};

export default async function QueueSettingsPage() {
  const workspace = await requireWorkspacePage();
  const settings = await getRestaurantSettings(workspace.restaurant!.id);

  if (!settings) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Queue settings"
        description="Restaurant defaults used when creating queues and issuing tokens. Individual queues can override name, prefix, and service duration."
        breadcrumbs={SETTINGS_QUEUE_BREADCRUMBS}
      />
      <QueueSettingsForm
        restaurantId={workspace.restaurant!.id}
        settings={settings}
        canManage={workspace.canManageRestaurant}
      />
    </div>
  );
}
