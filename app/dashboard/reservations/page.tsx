import type { Metadata } from "next";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { ReservationBoard } from "@/components/reservations/ReservationBoard";
import { requireWorkspacePage } from "@/lib/context/workspace";
import { AuthorizationError } from "@/lib/auth/guards";
import { RESERVATIONS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import {
  canManageReservations,
  canViewReservations,
} from "@/lib/utils/reservations";
import {
  getReservationsBundle,
  type ReservationBundle,
} from "@/services/reservations";

export const metadata: Metadata = {
  title: "Reservations",
};

export default async function ReservationsPage() {
  const workspace = await requireWorkspacePage();
  const role = workspace.role;

  if (!role || !canViewReservations(role)) {
    return (
      <div>
        <PageHeader
          title="Reservations"
          description="Manage bookings, arrivals, seating, and walk-ins."
          breadcrumbs={RESERVATIONS_BREADCRUMBS}
        />
        <ErrorState
          title="You do not have access"
          message="Your role cannot view reservations for this restaurant."
        />
      </div>
    );
  }

  if (!workspace.branch) {
    return (
      <div>
        <PageHeader
          title="Reservations"
          description="Manage bookings, arrivals, seating, and walk-ins."
          breadcrumbs={RESERVATIONS_BREADCRUMBS}
        />
        <EmptyState
          title="No active branch selected"
          description="Create or activate a branch before managing reservations. Reservations are always scoped to a single branch."
        />
      </div>
    );
  }

  let bundle: ReservationBundle | null = null;
  let errorMessage: string | null = null;

  try {
    bundle = await getReservationsBundle(workspace.branch.id, {
      view: "today",
      page: 1,
    });
  } catch (error) {
    errorMessage =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to load reservations. Please try again.";
  }

  if (!bundle || !workspace.restaurant) {
    return (
      <div>
        <PageHeader
          title="Reservations"
          description="Manage bookings, arrivals, seating, and walk-ins."
          breadcrumbs={RESERVATIONS_BREADCRUMBS}
        />
        <ErrorState
          title="Unable to load reservations"
          message={errorMessage ?? "Unable to load reservations. Please try again."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description={
          canManageReservations(role)
            ? "Create bookings, check guests in, seat tables, and handle walk-ins."
            : "View bookings for the selected branch."
        }
        breadcrumbs={RESERVATIONS_BREADCRUMBS}
      />
      <ReservationBoard
        key={`${bundle.branch.id}:${bundle.businessDate}`}
        initialBundle={bundle}
        restaurantId={workspace.restaurant.id}
      />
    </div>
  );
}
