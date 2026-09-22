import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import type { BreadcrumbItem } from "@/components/common/Breadcrumbs";

type AccessDeniedProps = {
  title: string;
  description?: string;
  message?: string;
  breadcrumbs?: BreadcrumbItem[];
};

export function AccessDenied({
  title,
  description,
  message = "Your role cannot access this page for this restaurant.",
  breadcrumbs,
}: AccessDeniedProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
      />
      <ErrorState title="You do not have access" message={message} />
    </div>
  );
}
