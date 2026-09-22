import type { Metadata } from "next";
import { AccessDenied } from "@/components/common/AccessDenied";
import { PageHeader } from "@/components/common/PageHeader";
import { BillingScreen } from "@/components/billing/BillingScreen";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_BILLING_PATH } from "@/lib/auth/paths";
import { SETTINGS_BILLING_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { getBillingOverview } from "@/services/billing/billing.service";

export const metadata: Metadata = {
  title: "Billing",
};

export default async function BillingSettingsPage() {
  const workspace = await requireWorkspacePage();

  if (!canAccessHref(workspace.role, SETTINGS_BILLING_PATH)) {
    return (
      <AccessDenied
        title="Billing"
        description="Subscription plan, usage, and payment history."
        breadcrumbs={SETTINGS_BILLING_BREADCRUMBS}
      />
    );
  }

  const restaurant = workspace.restaurant!;
  const overview = await getBillingOverview(restaurant.id);

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Manage this restaurant’s subscription, usage limits, and payment history."
        breadcrumbs={SETTINGS_BILLING_BREADCRUMBS}
      />
      <BillingScreen
        key={overview.subscription?.updated_at ?? overview.status}
        restaurantId={restaurant.id}
        role={workspace.role!}
        initialOverview={overview}
      />
    </div>
  );
}
