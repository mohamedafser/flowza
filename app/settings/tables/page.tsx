import type { Metadata } from "next";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionManager } from "@/components/tables/SectionManager";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { AuthorizationError } from "@/lib/auth/guards";
import { SETTINGS_TABLES_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { canManageTableSections, canViewTables } from "@/lib/utils/tables";
import { getTablesBundle, type TablesBundle } from "@/services/tables";

export const metadata: Metadata = {
  title: "Table sections",
};

export default async function TableSectionsSettingsPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canViewTables(role)) {
    return (
      <div>
        <PageHeader
          title="Table sections"
          description="Organize tables into areas such as Indoor, Outdoor, VIP, or Bar."
          breadcrumbs={SETTINGS_TABLES_BREADCRUMBS}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view table sections for this restaurant."
        />
      </div>
    );
  }

  if (!workspace.branch) {
    return (
      <div>
        <PageHeader
          title="Table sections"
          description="Organize tables into areas such as Indoor, Outdoor, VIP, or Bar."
          breadcrumbs={SETTINGS_TABLES_BREADCRUMBS}
        />
        <EmptyState
          title="No active branch selected"
          description="Create or activate a branch before managing table sections."
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
        : "Unable to load sections. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Table sections"
          description="Organize tables into areas such as Indoor, Outdoor, VIP, or Bar."
          breadcrumbs={SETTINGS_TABLES_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load sections"
          message={errorMessage ?? "Unable to load sections. Please try again."}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Table sections"
        description={`Organize tables for ${bundle.branch.name}. Move tables before deleting a section.`}
        breadcrumbs={SETTINGS_TABLES_BREADCRUMBS}
      />
      <SectionManager
        branchId={bundle.branch.id}
        sections={bundle.sections}
        tables={bundle.tables}
        canManage={canManageTableSections(role)}
      />
    </div>
  );
}
