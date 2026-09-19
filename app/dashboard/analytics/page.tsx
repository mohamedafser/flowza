import type { Metadata } from "next";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { DashboardBoard } from "@/components/analytics/DashboardBoard";
import { AuthorizationError } from "@/lib/auth/guards";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { ANALYTICS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { canViewAnalytics } from "@/lib/utils/analytics";
import { getDashboardOverviewForBranch } from "@/services/analytics/dashboard";
import type { DashboardBundle } from "@/lib/analytics/types";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canViewAnalytics(role)) {
    return (
      <div>
        <PageHeader
          title="Analytics"
          description="Performance insights for your restaurant."
          breadcrumbs={ANALYTICS_BREADCRUMBS}
        />
        <ErrorState
          title="You do not have access"
          message="Analytics requires the analytics.view permission. Operational metrics remain available on Overview."
        />
      </div>
    );
  }

  if (!workspace.branch || !workspace.restaurant) {
    return (
      <div>
        <PageHeader
          title="Analytics"
          description="Performance insights for your restaurant."
          breadcrumbs={ANALYTICS_BREADCRUMBS}
        />
        <EmptyState
          title="No active branch selected"
          description="Create or activate a branch before viewing analytics."
        />
      </div>
    );
  }

  let bundle: DashboardBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getDashboardOverviewForBranch(workspace.branch.id, {
      preset: "last_7_days",
    });
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load analytics. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Analytics"
          description="Performance insights for your restaurant."
          breadcrumbs={ANALYTICS_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load analytics"
          message={errorMessage ?? "Unable to load analytics. Please try again."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`${bundle.branchName} · trends, peak hours, and branch comparison.`}
        breadcrumbs={ANALYTICS_BREADCRUMBS}
      />
      <DashboardBoard
        key={`${bundle.branchId}:${bundle.range.startDate}:analytics`}
        initialBundle={bundle}
        restaurantId={workspace.restaurant.id}
        comparableBranches={workspace.activeBranches.map((branch) => ({
          id: branch.id,
          name: branch.name,
        }))}
        mode="analytics"
      />
    </div>
  );
}
