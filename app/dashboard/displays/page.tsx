import type { Metadata } from "next";
import { DisplayBoard } from "@/components/displays/DisplayBoard";
import { PageHeader } from "@/components/common/PageHeader";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { DISPLAYS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { hasPermission } from "@/lib/auth/permissions";
import { listBranchesByRestaurantId } from "@/services/branches";
import { getDisplays, listQueuesForDisplayForm } from "@/services/displays";

export const metadata: Metadata = {
  title: "Displays",
};

export const dynamic = "force-dynamic";

export default async function DisplaysPage() {
  const workspace = await requireWorkspacePage();
  const restaurantId = workspace.restaurant!.id;
  const role = workspace.role!;
  const canView = hasPermission(role, "displays.view");
  const canManage = hasPermission(role, "displays.manage");

  if (!canView) {
    return (
      <div>
        <PageHeader
          title="Displays"
          description="You do not have permission to view displays."
          breadcrumbs={DISPLAYS_BREADCRUMBS}
        />
      </div>
    );
  }

  const [displays, branches, queues] = await Promise.all([
    getDisplays(restaurantId),
    listBranchesByRestaurantId(restaurantId),
    listQueuesForDisplayForm(restaurantId),
  ]);

  return (
    <div>
      <PageHeader
        title="Displays"
        description="TV and lobby screens that show now-serving and next queue tokens — never customer details. Keep the TV browser awake in device settings for long sessions."
        breadcrumbs={DISPLAYS_BREADCRUMBS}
      />
      <DisplayBoard
        restaurantId={restaurantId}
        displays={displays}
        branches={branches}
        queues={queues}
        canManage={canManage}
      />
    </div>
  );
}
