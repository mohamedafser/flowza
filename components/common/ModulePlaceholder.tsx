import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { dashboardBreadcrumbs } from "@/lib/navigation/breadcrumbs";

type ModulePlaceholderProps = {
  title: string;
  description: string;
};

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={dashboardBreadcrumbs({ label: title })}
      />
      <EmptyState
        title={`${title} coming soon`}
        description="This module is a navigation placeholder for Phase 1 and is not implemented yet."
      />
    </div>
  );
}
