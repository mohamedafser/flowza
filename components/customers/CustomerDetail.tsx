"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { CustomerProfile } from "@/components/customers/CustomerProfile";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { DASHBOARD_CUSTOMERS_PATH } from "@/lib/auth/paths";
import { customerDetailBreadcrumbs } from "@/lib/navigation/breadcrumbs";
import {
  withVisitPlaceholder,
  type CustomerListItem,
} from "@/lib/utils/customers";
import type { CustomerReservationHistory } from "@/lib/utils/reservations";
import type { CustomerRecord } from "@/services/customers";

type CustomerDetailProps = {
  customer: CustomerListItem;
  timezone: string;
  canManage: boolean;
  reservationHistory?: CustomerReservationHistory | null;
};

export function CustomerDetail({
  customer: initialCustomer,
  timezone,
  canManage,
  reservationHistory = null,
}: CustomerDetailProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState(initialCustomer);

  const handleSaved = (saved: CustomerRecord) => {
    setCustomer(withVisitPlaceholder(saved));
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={customer.name}
        description="Restaurant customer record."
        breadcrumbs={customerDetailBreadcrumbs(customer.name)}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              router.push(DASHBOARD_CUSTOMERS_PATH);
              router.refresh();
            }}
          >
            All customers
          </Button>
        }
      />

      <CustomerProfile
        customer={customer}
        timezone={timezone}
        reservationHistory={reservationHistory}
      />

      {canManage ? (
        <section className="max-w-xl space-y-3">
          <h2 className="text-lg font-medium">Edit customer</h2>
          <CustomerForm
            key={`${customer.id}:${customer.updated_at}`}
            mode="edit"
            customer={customer}
            canManage
            onSaved={handleSaved}
          />
        </section>
      ) : null}
    </div>
  );
}
