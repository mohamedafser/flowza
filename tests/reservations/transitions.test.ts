import { describe, expect, it } from "vitest";
import {
  allowedReservationTransitions,
  canTransitionReservationStatus,
  reservationActionsForStatus,
} from "@/lib/reservations/transitions";
import { RESERVATION_STATUSES } from "@/lib/validations/reservation";

describe("reservation status transitions", () => {
  it("allows the primary dining flow", () => {
    expect(canTransitionReservationStatus("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionReservationStatus("CONFIRMED", "ARRIVED")).toBe(true);
    expect(canTransitionReservationStatus("ARRIVED", "SEATED")).toBe(true);
    expect(canTransitionReservationStatus("SEATED", "COMPLETED")).toBe(true);
  });

  it("allows cancellation and no-show paths", () => {
    expect(canTransitionReservationStatus("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionReservationStatus("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransitionReservationStatus("CONFIRMED", "NO_SHOW")).toBe(true);
    expect(canTransitionReservationStatus("ARRIVED", "CANCELLED")).toBe(true);
    expect(canTransitionReservationStatus("ARRIVED", "NO_SHOW")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionReservationStatus("PENDING", "ARRIVED")).toBe(false);
    expect(canTransitionReservationStatus("PENDING", "SEATED")).toBe(false);
    expect(canTransitionReservationStatus("CONFIRMED", "SEATED")).toBe(false);
    expect(canTransitionReservationStatus("CONFIRMED", "COMPLETED")).toBe(false);
    expect(canTransitionReservationStatus("SEATED", "CANCELLED")).toBe(false);
    expect(canTransitionReservationStatus("COMPLETED", "PENDING")).toBe(false);
    expect(canTransitionReservationStatus("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransitionReservationStatus("NO_SHOW", "ARRIVED")).toBe(false);
  });

  it("treats same-status as idempotent", () => {
    for (const status of RESERVATION_STATUSES) {
      expect(canTransitionReservationStatus(status, status)).toBe(true);
    }
  });

  it("exposes actions matching allowed targets", () => {
    const confirmed = reservationActionsForStatus("CONFIRMED");
    expect(confirmed.canArrive).toBe(true);
    expect(confirmed.canSeat).toBe(false);
    expect(confirmed.canCancel).toBe(true);
    expect(confirmed.canConvertToQueue).toBe(true);
    expect(allowedReservationTransitions("SEATED")).toEqual(["COMPLETED"]);
  });
});
