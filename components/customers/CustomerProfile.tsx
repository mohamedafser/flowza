import { Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/utils/datetime";
import {
  formatReservationTime,
  reservationStatusLabel,
  reservationStatusTone,
  type CustomerReservationHistory,
} from "@/lib/utils/reservations";
import type { CustomerRecord } from "@/lib/utils/customers";

type CustomerProfileProps = {
  customer: CustomerRecord;
  timezone: string;
  reservationHistory?: CustomerReservationHistory | null;
};

function ContactValue({
  href,
  label,
  empty,
  icon,
}: {
  href: string | null;
  label: string;
  empty: string;
  icon: React.ReactNode;
}) {
  if (!href) {
    return <span className="text-muted-foreground">{empty}</span>;
  }

  return (
    <a
      href={href}
      className="text-foreground inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
    >
      {icon}
      {label}
    </a>
  );
}

export function CustomerProfile({
  customer,
  timezone,
  reservationHistory,
}: CustomerProfileProps) {
  const history = reservationHistory ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Customer profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{customer.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <ContactValue
              href={customer.phone ? `tel:${customer.phone}` : null}
              label={customer.phone ?? ""}
              empty="No phone on file"
              icon={<Phone className="size-4" />}
            />
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <ContactValue
              href={customer.email ? `mailto:${customer.email}` : null}
              label={customer.email ?? ""}
              empty="No email on file"
              icon={<Mail className="size-4" />}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="font-medium">
              {formatDate(
                new Date(customer.created_at),
                "DD/MM/YYYY",
                timezone,
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last updated</p>
            <p className="font-medium">
              {formatDate(
                new Date(customer.updated_at),
                "DD/MM/YYYY",
                timezone,
              )}
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            Customer records belong to the restaurant, not a single branch.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Reservation history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {history && history.total > 0 ? (
            <>
              <ul className="grid gap-3 sm:grid-cols-4">
                <li className="border-border rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="text-lg font-semibold">{history.total}</p>
                </li>
                <li className="border-border rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-xs">Completed</p>
                  <p className="text-lg font-semibold">{history.completed}</p>
                </li>
                <li className="border-border rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-xs">Cancelled</p>
                  <p className="text-lg font-semibold">{history.cancelled}</p>
                </li>
                <li className="border-border rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-xs">No-shows</p>
                  <p className="text-lg font-semibold">{history.noShow}</p>
                </li>
              </ul>
              <ul className="space-y-2">
                {history.recent.map((row) => (
                  <li
                    key={row.id}
                    className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {row.reservation_date} ·{" "}
                        {formatReservationTime(row.start_time)} · party{" "}
                        {row.party_size}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {row.reservation_code ?? row.id.slice(0, 8)}
                      </p>
                    </div>
                    <StatusBadge
                      label={reservationStatusLabel(row.status)}
                      tone={reservationStatusTone(row.status)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground">
              No reservation activity yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
