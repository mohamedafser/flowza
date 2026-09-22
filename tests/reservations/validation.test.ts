import { describe, expect, it } from "vitest";
import {
  authorizeReservationScope,
  canManageReservations,
  canViewReservations,
  summarizeCustomerReservations,
} from "@/lib/utils/reservations";
import {
  createReservationSchema,
  createWalkInSchema,
  cancelReservationSchema,
} from "@/lib/validations/reservation";
import { hasPermission } from "@/lib/auth/permissions";

describe("reservation validation", () => {
  it("accepts a valid reservation payload", () => {
    const parsed = createReservationSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
      reservationDate: "2026-09-20",
      startTime: "19:00",
      partySize: 4,
      durationMinutes: 90,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts null notes, special requests, and empty tableId", () => {
    const parsed = createReservationSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
      reservationDate: "2026-09-20",
      startTime: "19:00",
      partySize: 4,
      durationMinutes: 90,
      tableId: null,
      notes: null,
      specialRequests: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notes).toBeNull();
      expect(parsed.data.specialRequests).toBeNull();
      expect(parsed.data.tableId).toBeNull();
    }
  });

  it("accepts arrived flag on create", () => {
    const parsed = createReservationSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
      reservationDate: "2026-09-20",
      startTime: "19:00",
      partySize: 4,
      durationMinutes: 90,
      tableId: "33333333-3333-4333-8333-333333333333",
      arrived: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.arrived).toBe(true);
    }
  });

  it("rejects past-looking invalid party sizes and missing ids", () => {
    const parsed = createReservationSchema.safeParse({
      branchId: "not-a-uuid",
      customerId: "22222222-2222-4222-8222-222222222222",
      reservationDate: "2026-09-20",
      startTime: "19:00",
      partySize: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it("requires queue or table based on walk-in mode", () => {
    const queueMissing = createWalkInSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      mode: "queue",
      name: "Alex",
      phone: "+14155552671",
      partySize: 2,
    });
    expect(queueMissing.success).toBe(false);

    const seatOk = createWalkInSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      mode: "seat",
      tableId: "33333333-3333-4333-8333-333333333333",
      name: "Alex",
      phone: "+14155552671",
      partySize: 2,
    });
    expect(seatOk.success).toBe(true);

    const phoneMissing = createWalkInSchema.safeParse({
      branchId: "11111111-1111-4111-8111-111111111111",
      mode: "seat",
      tableId: "33333333-3333-4333-8333-333333333333",
      name: "Alex",
      partySize: 2,
    });
    expect(phoneMissing.success).toBe(false);
  });

  it("accepts optional cancel reasons", () => {
    const parsed = cancelReservationSchema.safeParse({
      reservationId: "11111111-1111-4111-8111-111111111111",
      reason: "Guest cancelled",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("reservation security helpers", () => {
  it("enforces restaurant and branch scope", () => {
    expect(
      authorizeReservationScope({
        membershipRestaurantId: "r1",
        reservationRestaurantId: "r1",
        currentRestaurantId: "r1",
        reservationBranchId: "b1",
        expectedBranchId: "b1",
      }).ok,
    ).toBe(true);

    expect(
      authorizeReservationScope({
        membershipRestaurantId: "r1",
        reservationRestaurantId: "r2",
        currentRestaurantId: "r1",
        reservationBranchId: "b1",
        expectedBranchId: "b1",
      }).ok,
    ).toBe(false);

    const crossBranch = authorizeReservationScope({
      membershipRestaurantId: "r1",
      reservationRestaurantId: "r1",
      currentRestaurantId: "r1",
      reservationBranchId: "b2",
      expectedBranchId: "b1",
    });
    expect(crossBranch.ok).toBe(false);
    if (!crossBranch.ok) {
      expect(crossBranch.reason).toBe("branch");
    }
  });

  it("maps RBAC for reservation permissions", () => {
    expect(canViewReservations("STAFF")).toBe(true);
    expect(canManageReservations("STAFF")).toBe(true);
    expect(hasPermission("STAFF", "reservations.manage")).toBe(true);
    expect(canManageReservations("MANAGER")).toBe(true);
  });

  it("summarizes customer reservation history", () => {
    const summary = summarizeCustomerReservations([
      {
        id: "1",
        reservation_code: "RES-1001",
        reservation_date: "2026-09-18",
        start_time: "19:00:00",
        party_size: 2,
        status: "COMPLETED",
        branch_id: "b1",
      },
      {
        id: "2",
        reservation_code: "RES-1002",
        reservation_date: "2026-09-19",
        start_time: "20:00:00",
        party_size: 4,
        status: "NO_SHOW",
        branch_id: "b1",
      },
      {
        id: "3",
        reservation_code: "RES-1003",
        reservation_date: "2026-09-10",
        start_time: "18:00:00",
        party_size: 3,
        status: "CANCELLED",
        branch_id: "b1",
      },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(1);
    expect(summary.noShow).toBe(1);
    expect(summary.cancelled).toBe(1);
    expect(summary.recent[0]?.id).toBe("2");
  });
});
