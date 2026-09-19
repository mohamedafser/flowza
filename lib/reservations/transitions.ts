import {
  RESERVATION_STATUSES,
  type ReservationStatus,
} from "@/lib/validations/reservation";

const RESERVATION_STATUS_TRANSITIONS: Record<
  ReservationStatus,
  readonly ReservationStatus[]
> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ARRIVED", "CANCELLED", "NO_SHOW"],
  ARRIVED: ["SEATED", "CANCELLED", "NO_SHOW"],
  SEATED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function isReservationStatus(
  value: unknown,
): value is ReservationStatus {
  return (
    typeof value === "string" &&
    (RESERVATION_STATUSES as readonly string[]).includes(value)
  );
}

export function allowedReservationTransitions(
  from: ReservationStatus,
): readonly ReservationStatus[] {
  return RESERVATION_STATUS_TRANSITIONS[from];
}

export function canTransitionReservationStatus(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  if (from === to) {
    return true;
  }
  if (!isReservationStatus(from) || !isReservationStatus(to)) {
    return false;
  }
  return RESERVATION_STATUS_TRANSITIONS[from].includes(to);
}

export function reservationActionsForStatus(status: ReservationStatus): {
  canConfirm: boolean;
  canEdit: boolean;
  canCancel: boolean;
  canArrive: boolean;
  canAssignTable: boolean;
  canSeat: boolean;
  canComplete: boolean;
  canNoShow: boolean;
  canConvertToQueue: boolean;
} {
  const editable =
    status === "PENDING" || status === "CONFIRMED" || status === "ARRIVED";

  return {
    canConfirm:
      canTransitionReservationStatus(status, "CONFIRMED") &&
      status !== "CONFIRMED",
    canEdit: editable,
    canCancel:
      canTransitionReservationStatus(status, "CANCELLED") &&
      status !== "CANCELLED",
    canArrive:
      canTransitionReservationStatus(status, "ARRIVED") && status !== "ARRIVED",
    canAssignTable: editable,
    canSeat:
      canTransitionReservationStatus(status, "SEATED") && status !== "SEATED",
    canComplete:
      canTransitionReservationStatus(status, "COMPLETED") &&
      status !== "COMPLETED",
    canNoShow:
      canTransitionReservationStatus(status, "NO_SHOW") &&
      status !== "NO_SHOW",
    canConvertToQueue: status === "ARRIVED" || status === "CONFIRMED",
  };
}
