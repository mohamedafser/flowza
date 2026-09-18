import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { CustomerExperienceForm } from "@/components/settings/CustomerExperienceForm";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_CUSTOMER_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getRestaurantSettings } from "@/services/settings";

export const metadata: Metadata = {
  title: "Customer experience",
};

export default async function CustomerExperiencePage() {
  const workspace = await requireWorkspacePage();
  const settings = await getRestaurantSettings(workspace.restaurant!.id);

  if (!settings) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Customer experience"
        description="Guest-facing preferences for future queue screens. These settings do not publish a customer page yet."
        breadcrumbs={SETTINGS_CUSTOMER_BREADCRUMBS}
      />
      <CustomerExperienceForm
        restaurantId={workspace.restaurant!.id}
        settings={settings}
        canManage={workspace.canManageRestaurant}
      />
    </div>
  );
}
