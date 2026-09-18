import { Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/datetime";
import type { CustomerRecord } from "@/lib/utils/customers";

type CustomerProfileProps = {
  customer: CustomerRecord;
  timezone: string;
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

export function CustomerProfile({ customer, timezone }: CustomerProfileProps) {
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
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            No queue or reservation activity yet.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Queue history",
              "Reservation history",
              "Visit history",
              "No-show history",
              "Notification history",
            ].map((label) => (
              <li
                key={label}
                className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-2"
              >
                {label}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
