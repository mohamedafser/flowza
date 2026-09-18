import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { CUSTOMERS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";

export default function CustomersLoading() {
  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your restaurant's customer records."
        breadcrumbs={CUSTOMERS_BREADCRUMBS}
      />
      <LoadingState label="Loading customers…" rows={6} />
    </div>
  );
}
