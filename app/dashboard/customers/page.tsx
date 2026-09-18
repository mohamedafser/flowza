import type { Metadata } from "next";
import { CustomerBoard } from "@/components/customers/CustomerBoard";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { AuthorizationError } from "@/lib/auth/guards";
import { CUSTOMERS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { canManageCustomers, canViewCustomers } from "@/lib/utils/customers";
import { getCustomersBundle, type CustomersBundle } from "@/services/customers";

export const metadata: Metadata = {
  title: "Customers",
};

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;
  const restaurant = workspace.restaurant;

  if (!role || !restaurant || !canViewCustomers(role)) {
    return (
      <div>
        <PageHeader
          title="Customers"
          description="Manage your restaurant's customer records."
          breadcrumbs={CUSTOMERS_BREADCRUMBS}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view customers for this restaurant."
        />
      </div>
    );
  }

  let bundle: CustomersBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getCustomersBundle(restaurant.id);
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load customers. Please try again.";
  }

  if (!bundle) {
    return (
      <div>
        <PageHeader
          title="Customers"
          description="Manage your restaurant's customer records."
          breadcrumbs={CUSTOMERS_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load customers"
          message={
            errorMessage ?? "Unable to load customers. Please try again."
          }
        />
      </div>
    );
  }

  return (
    <CustomerBoard
      key={bundle.customers
        .map((item) => `${item.id}:${item.updated_at}`)
        .join("|")}
      customers={bundle.customers}
      stats={bundle.stats}
      timezone={bundle.timezone}
      canManage={canManageCustomers(role)}
    />
  );
}
