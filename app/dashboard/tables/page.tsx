import type { Metadata } from "next";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { TableBoard } from "@/components/tables/TableBoard";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { AuthorizationError } from "@/lib/auth/guards";
import { dashboardBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import {
  canChangeTableStatus,
  canDeleteTables,
  canManageTableSections,
  canManageTables,
  canViewTables,
} from "@/lib/utils/tables";
import { getTablesBundle, type TablesBundle } from "@/services/tables";

export const metadata: Metadata = {
  title: "Tables",
};

export default async function TablesPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canViewTables(role)) {
    return (
      <div>
        <PageHeader
          title="Tables"
          description="Manage tables, seating capacity, sections, and availability."
          breadcrumbs={dashboardBreadcrumbs({ label: "Tables" })}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view tables for this restaurant."
        />
      </div>
    );
  }

  if (!workspace.branch) {
    return (
      <div>
        <PageHeader
          title="Tables"
          description="Manage tables, seating capacity, sections, and availability."
          breadcrumbs={dashboardBreadcrumbs({ label: "Tables" })}
        />
        <EmptyState
          title="No active branch selected"
          description="Create or activate a branch before managing tables. Tables are always scoped to a single branch."
        />
      </div>
    );
  }

  let bundle: TablesBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getTablesBundle(workspace.branch.id);
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load tables. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Tables"
          description="Manage tables, seating capacity, sections, and availability."
          breadcrumbs={dashboardBreadcrumbs({ label: "Tables" })}
        />
        <ErrorState
          title="Unable to load tables"
          message={errorMessage ?? "Unable to load tables. Please try again."}
        />
      </div>
    );
  }

  return (
    <TableBoard
      key={bundle.branch.id}
      branch={bundle.branch}
      tables={bundle.tables}
      sections={bundle.sections}
      canManage={canManageTables(role)}
      canDelete={canDeleteTables(role)}
      canManageSections={canManageTableSections(role)}
      canChangeStatus={canChangeTableStatus(role)}
    />
  );
}
