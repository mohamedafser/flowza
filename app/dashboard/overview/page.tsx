import type { Metadata } from "next";
import {
  CheckCircle2,
  ListOrdered,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { dashboardBreadcrumbs } from "@/lib/navigation/breadcrumbs";

export const metadata: Metadata = {
  title: "Overview",
};

const PLACEHOLDER_STATS = [
  {
    title: "Waiting Customers",
    value: "—",
    description: "Placeholder · not connected yet",
    icon: <Users />,
  },
  {
    title: "Available Tables",
    value: "—",
    description: "Placeholder · not connected yet",
    icon: <UtensilsCrossed />,
  },
  {
    title: "Currently Serving",
    value: "—",
    description: "Placeholder · not connected yet",
    icon: <ListOrdered />,
  },
  {
    title: "Today's Served Customers",
    value: "—",
    description: "Placeholder · not connected yet",
    icon: <CheckCircle2 />,
  },
] as const;

export default function DashboardOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="High-level restaurant floor snapshot. Live metrics will connect in a later phase."
        breadcrumbs={dashboardBreadcrumbs({ label: "Overview" })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLACEHOLDER_STATS.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="mt-8">
        <EmptyState
          title="Queue modules coming soon"
          description="Queue, tables, customers, reservations, and analytics will appear here in later phases."
        />
      </div>
    </div>
  );
}
