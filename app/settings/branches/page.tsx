import type { Metadata } from "next";
import { AccessDenied } from "@/components/common/AccessDenied";
import { PageHeader } from "@/components/common/PageHeader";
import { BranchList } from "@/components/restaurant/BranchList";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import { SETTINGS_BRANCHES_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";

export const metadata: Metadata = {
  title: "Branches",
};

export default async function BranchesSettingsPage() {
  const workspace = await requireWorkspacePage();

  if (!canAccessHref(workspace.role, SETTINGS_BRANCHES_PATH)) {
    return (
      <AccessDenied
        title="Branches"
        description="Manage locations for this restaurant. Only active branches can be selected for operations."
        message="Only owners and admins can manage branches."
        breadcrumbs={SETTINGS_BRANCHES_BREADCRUMBS}
      />
    );
  }

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
