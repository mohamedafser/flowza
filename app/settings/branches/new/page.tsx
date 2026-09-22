import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/common/AccessDenied";
import { PageHeader } from "@/components/common/PageHeader";
import { BranchForm } from "@/components/restaurant/BranchForm";
import { Button } from "@/components/ui/button";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { canAccessHref } from "@/lib/auth/navigation";
import { SETTINGS_BRANCHES_PATH } from "@/lib/auth/paths";
import { settingsNewBranchBreadcrumbs } from "@/lib/navigation/breadcrumbs";

export const metadata: Metadata = {
  title: "New branch",
};

export default async function NewBranchPage() {
  const workspace = await requireWorkspacePage();

  if (!canAccessHref(workspace.role, SETTINGS_BRANCHES_PATH)) {
    return (
      <AccessDenied
        title="Create branch"
        description="Add a new location under your restaurant."
        message="Only owners and admins can manage branches."
        breadcrumbs={settingsNewBranchBreadcrumbs()}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Create branch"
        description="Add a new location under your restaurant."
        breadcrumbs={settingsNewBranchBreadcrumbs()}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href={SETTINGS_BRANCHES_PATH} />}
            nativeButton={false}
          >
            Back
          </Button>
        }
      />
      <BranchForm
        mode="create"
        restaurantId={workspace.restaurant!.id}
        canManage={workspace.canManageRestaurant}
        defaultTimezone={workspace.restaurant!.timezone}
      />
    </div>
  );
}
