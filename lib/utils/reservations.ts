import { hasPermission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";
import type { StatusTone } from "@/types";
import {
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/validations/reservation";

export type ReservationCustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type ReservationTableSummary = {
  id: string;
  table_number: string;
  name: string | null;
  capacity: number;
  status: string;
  branch_id: string;
};

export type ReservationRecord = {
  id: string;
  branch_id: string;
  customer_id: string | null;
  reservation_code: string | null;
  reservation_date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  party_size: number;
  status: ReservationStatus;
  notes: string | null;
  special_requests: string | null;
  cancelled_reason: string | null;
  table_id: string | null;
  created_by: string | null;
  confirmed_at: string | null;
  arrived_at: string | null;
  seated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationWithRelations = ReservationRecord & {
  customer: ReservationCustomerSummary | null;
  table: ReservationTableSummary | null;
};

export type ReservationStats = {
  pending: number;
  confirmed: number;
  arrived: number;
  seated: number;
  completed: number;
  cancelled: number;
  noShow: number;
  total: number;
};

export type ReservationScopeInput = {
  membershipRestaurantId: string;
  reservationRestaurantId: string;
  currentRestaurantId: string;
  reservationBranchId: string;
  expectedBranchId: string;
};

export type ReservationScopeResult =
  | { ok: true }
  | { ok: false; reason: "restaurant" | "branch" };

export function canViewReservations(role: MemberRole): boolean {
  return hasPermission(role, "reservations.view");
}

export function canManageReservations(role: MemberRole): boolean {
  return hasPermission(role, "reservations.manage");
}

export function authorizeReservationScope(
  input: ReservationScopeInput,
): ReservationScopeResult {
  if (
    input.membershipRestaurantId !== input.currentRestaurantId ||
    input.reservationRestaurantId !== input.currentRestaurantId
  ) {
    return { ok: false, reason: "restaurant" };
  }
  if (input.reservationBranchId !== input.expectedBranchId) {
    return { ok: false, reason: "branch" };
  }
  return { ok: true };
}

export function reservationStatusTone(status: ReservationStatus): StatusTone {
  switch (status) {
    case "PENDING":
      return "warning";
    case "CONFIRMED":
      return "info";
    case "ARRIVED":
      return "info";
    case "SEATED":
      return "success";
    case "COMPLETED":
      return "default";
    case "CANCELLED":
      return "danger";
    case "NO_SHOW":
      return "danger";
    default:
      return "default";
  }
}

export function reservationStatusLabel(status: ReservationStatus): string {
  return RESERVATION_STATUS_LABELS[status] ?? status;
}

export function formatReservationTime(value: string): string {
  if (value.length >= 5) {
    return value.slice(0, 5);
  }
  return value;
}

export function deriveReservationStatistics(
  rows: readonly Pick<ReservationRecord, "status">[],
): ReservationStats {
  const stats: ReservationStats = {
    pending: 0,
    confirmed: 0,
    arrived: 0,
    seated: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    total: rows.length,
  };

  for (const row of rows) {
    switch (row.status) {
      case "PENDING":
        stats.pending += 1;
        break;
      case "CONFIRMED":
        stats.confirmed += 1;
        break;
      case "ARRIVED":
        stats.arrived += 1;
        break;
      case "SEATED":
        stats.seated += 1;
        break;
      case "COMPLETED":
        stats.completed += 1;
        break;
      case "CANCELLED":
        stats.cancelled += 1;
        break;
      case "NO_SHOW":
        stats.noShow += 1;
        break;
      default:
        break;
    }
  }

  return stats;
}

export function matchesReservationSearch(
  reservation: Pick<ReservationRecord, "reservation_code" | "notes"> & {
    customer: Pick<ReservationCustomerSummary, "name" | "phone"> | null;
  },
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  if (reservation.reservation_code?.toLowerCase().includes(query)) {
    return true;
  }
  if (reservation.customer?.name.toLowerCase().includes(query)) {
    return true;
  }
  if (reservation.customer?.phone?.toLowerCase().includes(query)) {
    return true;
  }
  if (reservation.notes?.toLowerCase().includes(query)) {
    return true;
  }
  return false;
}

export type CustomerReservationHistory = {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  recent: Array<{
    id: string;
    reservation_code: string | null;
    reservation_date: string;
    start_time: string;
    party_size: number;
    status: ReservationStatus;
    branch_id: string;
  }>;
};

export function emptyCustomerReservationHistory(): CustomerReservationHistory {
  return {
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    recent: [],
  };
}

export function summarizeCustomerReservations(
  rows: readonly {
    id: string;
    reservation_code: string | null;
    reservation_date: string;
    start_time: string;
    party_size: number;
    status: ReservationStatus;
    branch_id: string;
  }[],
  limit = 10,
): CustomerReservationHistory {
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;

  for (const row of rows) {
    if (row.status === "COMPLETED") completed += 1;
    if (row.status === "CANCELLED") cancelled += 1;
    if (row.status === "NO_SHOW") noShow += 1;
  }

  const recent = [...rows]
    .sort((left, right) => {
      const byDate = right.reservation_date.localeCompare(left.reservation_date);
      if (byDate !== 0) return byDate;
      return right.start_time.localeCompare(left.start_time);
    })
    .slice(0, limit);

  return {
    total: rows.length,
    completed,
    cancelled,
    noShow,
    recent,
  };
}
