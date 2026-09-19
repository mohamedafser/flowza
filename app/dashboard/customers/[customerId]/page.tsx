import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { customerDetailBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import { canManageCustomers, canViewCustomers } from "@/lib/utils/customers";
import { getCustomer } from "@/services/customers";
import { getCustomerReservationHistory } from "@/services/reservations";

type PageProps = {
  params: Promise<{ customerId: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { customerId } = await params;
  if (!UUID_RE.test(customerId)) {
    return { title: "Customer" };
  }
  try {
    const customer = await getCustomer(customerId);
    return { title: customer?.name ?? "Customer" };
  } catch {
    return { title: "Customer" };
  }
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { customerId } = await params;
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canViewCustomers(role)) {
    return (
      <div>
        <PageHeader
          title="Customer"
          breadcrumbs={customerDetailBreadcrumbs("Customer")}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view customers for this restaurant."
        />
      </div>
    );
  }

  if (!UUID_RE.test(customerId)) {
    notFound();
  }

  const customer = await getCustomer(customerId);
  if (!customer) {
    notFound();
  }

  const canManage = canManageCustomers(role);
  const timezone = workspace.restaurant?.timezone || "UTC";
  const reservationHistory = await getCustomerReservationHistory(customer.id);

  return (
    <CustomerDetail
      key={`${customer.id}:${customer.updated_at}`}
      customer={customer}
      timezone={timezone}
      canManage={canManage}
      reservationHistory={reservationHistory}
    />
  );
}
