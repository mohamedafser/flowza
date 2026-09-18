import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { DASHBOARD_CUSTOMERS_PATH } from "@/lib/auth/paths";
import { newCustomerBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { canManageCustomers, canViewCustomers } from "@/lib/utils/customers";

export const metadata: Metadata = {
  title: "Add customer",
};

export default async function NewCustomerPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canViewCustomers(role)) {
    return (
      <div>
        <PageHeader
          title="Add customer"
          description="Create a customer record for this restaurant."
          breadcrumbs={newCustomerBreadcrumbs()}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view customers for this restaurant."
        />
      </div>
    );
  }

  if (!canManageCustomers(role)) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Add customer"
        description="Create a customer record for this restaurant."
        breadcrumbs={newCustomerBreadcrumbs()}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href={DASHBOARD_CUSTOMERS_PATH} />}
            nativeButton={false}
          >
            Back
          </Button>
        }
      />
      <CustomerForm mode="create" canManage />
    </div>
  );
}
