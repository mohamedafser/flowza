import type { Metadata } from "next";
import { PageHeader } from "@/components/common/PageHeader";
import { BranchList } from "@/components/restaurant/BranchList";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { SETTINGS_BRANCHES_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";

export const metadata: Metadata = {
  title: "Branches",
};

export default async function BranchesSettingsPage() {
  const workspace = await requireWorkspacePage();

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage locations for this restaurant. Only active branches can be selected for operations."
        breadcrumbs={SETTINGS_BRANCHES_BREADCRUMBS}
      />
      <BranchList canManage={workspace.canManageRestaurant} />
    </div>
  );
}
