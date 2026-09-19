import type { Metadata } from "next";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { DashboardBoard } from "@/components/analytics/DashboardBoard";
import { AuthorizationError } from "@/lib/auth/guards";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { dashboardBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { getDashboardOverviewForBranch } from "@/services/analytics/dashboard";
import type { DashboardBundle } from "@/lib/analytics/types";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function DashboardOverviewPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (
    !role ||
    !hasAnyPermission(role, [
      "queue.view",
      "tables.view",
      "reservations.view",
      "customers.view",
      "analytics.view",
    ])
  ) {
    return (
      <div>
        <PageHeader
          title="Overview"
          description="Restaurant operations snapshot."
          breadcrumbs={dashboardBreadcrumbs({ label: "Overview" })}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view dashboard metrics for this restaurant."
        />
      </div>
    );
  }

  if (!workspace.branch || !workspace.restaurant) {
    return (
      <div>
        <PageHeader
          title="Overview"
          description="Restaurant operations snapshot."
          breadcrumbs={dashboardBreadcrumbs({ label: "Overview" })}
        />
        <EmptyState
          title="No active branch selected"
          description="Create or activate a branch before viewing the operations dashboard."
        />
      </div>
    );
  }

  let bundle: DashboardBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getDashboardOverviewForBranch(workspace.branch.id, {
      preset: "today",
    });
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load dashboard. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Overview"
          description="Restaurant operations snapshot."
          breadcrumbs={dashboardBreadcrumbs({ label: "Overview" })}
        />
        <ErrorState
          title="Unable to load dashboard"
          message={errorMessage ?? "Unable to load dashboard. Please try again."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`${bundle.branchName} · live operations and today's performance.`}
        breadcrumbs={dashboardBreadcrumbs({ label: "Overview" })}
      />
      <DashboardBoard
        key={`${bundle.branchId}:${bundle.range.startDate}`}
        initialBundle={bundle}
        restaurantId={workspace.restaurant.id}
        comparableBranches={workspace.activeBranches.map((branch) => ({
          id: branch.id,
          name: branch.name,
        }))}
        mode="overview"
      />
    </div>
  );
}
