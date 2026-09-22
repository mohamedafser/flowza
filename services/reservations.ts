import { cache } from "react";
import {
  AuthorizationError,
  requirePermission,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import {
  availabilityMessage,
  evaluateAvailability,
  normalizeReservationTime,
  resolveEndTime,
  type ExistingReservationSlot,
  type TableCandidate,
} from "@/lib/reservations/availability";
import {
  loadBranchOpenContext,
  resolveBranchHoursAt,
} from "@/lib/reservations/hours";
import { canTransitionReservationStatus } from "@/lib/reservations/transitions";
import {
  authorizeReservationScope,
  canManageReservations,
  deriveReservationStatistics,
  matchesReservationSearch,
  summarizeCustomerReservations,
  type CustomerReservationHistory,
  type ReservationRecord,
  type ReservationStats,
  type ReservationWithRelations,
} from "@/lib/utils/reservations";
import { resolveBranchTimezone } from "@/lib/utils/timezone";
import { getZonedDateParts } from "@/lib/utils/datetime";
import { addCalendarDays, type CustomerRecord } from "@/lib/utils/customers";
import type {
  AssignReservationTableInput,
  AvailabilityQuery,
  CancelReservationInput,
  ConvertReservationToQueueInput,
  CreateReservationInput,
  CreateWalkInInput,
  ReservationListQuery,
  ReservationStatus,
  SeatReservationInput,
  UpdateReservationInput,
} from "@/lib/validations/reservation";
import {
  DEFAULT_DURATION_MINUTES,
  TERMINAL_RESERVATION_STATUSES,
} from "@/lib/validations/reservation";
import { scheduleNotificationWork } from "@/lib/notifications/service";
import {
  notifyReservationArrived,
  notifyReservationCancelled,
  notifyReservationConfirmed,
  notifyReservationCreated,
  notifyReservationNoShow,
  notifyReservationSeated,
} from "@/lib/notifications/reservations";
import { findPotentialDuplicateCustomer } from "@/services/customers";
import { writeAuditLog } from "@/services/audit";
import { releaseExpiredCleaningTables } from "@/services/table-cleaning";
import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/lib/context/restaurant";
import type { Json, Tables } from "@/types/database";
import type { QueueEntryRecord } from "@/lib/utils/queue";

export type {
  ReservationRecord,
  ReservationStats,
  ReservationWithRelations,
  CustomerReservationHistory,
};

export type ReservationMutationCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "OUTSIDE_HOURS"
  | "INVALID_TRANSITION"
  | "UNKNOWN";

export type ReservationMutationResult =
  | { ok: true; reservation: ReservationRecord }
  | { ok: false; message: string; code: ReservationMutationCode };

export type WalkInMutationResult =
  | {
      ok: true;
      mode: "queue";
      entry: QueueEntryRecord;
      customerId: string;
    }
  | {
      ok: true;
      mode: "seat";
      customerId: string;
      tableId: string;
    }
  | { ok: false; message: string; code: ReservationMutationCode };

export type ConvertToQueueResult =
  | { ok: true; entry: QueueEntryRecord; reservation: ReservationRecord }
  | { ok: false; message: string; code: ReservationMutationCode };

export type ReservationBundle = {
  branch: Branch;
  timezone: string;
  businessDate: string;
  view: ReservationListQuery["view"];
  reservations: ReservationWithRelations[];
  stats: ReservationStats;
  tables: Array<TableCandidate & { tableNumber: string; name: string | null }>;
  queues: Array<{ id: string; name: string; status: string }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  canManage: boolean;
};

type ReservationRow = Tables<"reservations">;

type CustomerJoin =
  | {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    }
  | {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    }[]
  | null;

type TableJoin =
  | {
      id: string;
      table_number: string;
      name: string | null;
      capacity: number;
      status: string;
      branch_id: string;
    }
  | {
      id: string;
      table_number: string;
      name: string | null;
      capacity: number;
      status: string;
      branch_id: string;
    }[]
  | null;

type ReservationRowWithJoins = ReservationRow & {
  customer: CustomerJoin;
  table: TableJoin;
};

const RESERVATION_COLUMNS =
  "id, branch_id, customer_id, reservation_code, reservation_date, start_time, end_time, duration_minutes, party_size, status, notes, special_requests, cancelled_reason, table_id, created_by, confirmed_at, arrived_at, seated_at, completed_at, cancelled_at, no_show_at, created_at, updated_at";

const RESERVATION_SELECT = `${RESERVATION_COLUMNS}, customer:customers(id, name, phone, email), table:restaurant_tables(id, table_number, name, capacity, status, branch_id)`;

const BRANCH_SELECT =
  "id, organization_id, restaurant_id, name, slug, address_line_1, address_line_2, city, state, postal_code, country, phone, email, timezone, use_restaurant_timezone, is_active, created_at, updated_at";

function asReservation(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    branch_id: row.branch_id,
    customer_id: row.customer_id,
    reservation_code: row.reservation_code,
    reservation_date: row.reservation_date,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    party_size: row.party_size,
    status: row.status as ReservationStatus,
    notes: row.notes,
    special_requests: row.special_requests,
    cancelled_reason: row.cancelled_reason,
    table_id: row.table_id,
    created_by: row.created_by,
    confirmed_at: row.confirmed_at,
    arrived_at: row.arrived_at,
    seated_at: row.seated_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    no_show_at: row.no_show_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCustomerJoin(value: CustomerJoin) {
  if (!value) return null;
  const row = Array.isArray(value) ? (value[0] ?? null) : value;
  return row
    ? {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
      }
    : null;
}

function mapTableJoin(value: TableJoin) {
  if (!value) return null;
  const row = Array.isArray(value) ? (value[0] ?? null) : value;
  return row
    ? {
        id: row.id,
        table_number: row.table_number,
        name: row.name,
        capacity: row.capacity,
        status: row.status,
        branch_id: row.branch_id,
      }
    : null;
}

function asReservationWithRelations(
  row: ReservationRowWithJoins,
): ReservationWithRelations {
  return {
    ...asReservation(row),
    customer: mapCustomerJoin(row.customer),
    table: mapTableJoin(row.table),
  };
}

function asQueueEntry(row: Tables<"queue_entries">): QueueEntryRecord {
  return {
    id: row.id,
    queue_id: row.queue_id,
    customer_id: row.customer_id,
    table_id: row.table_id,
    token: row.token,
    business_date: row.business_date,
    party_size: row.party_size,
    status: row.status as QueueEntryRecord["status"],
    joined_at: row.joined_at,
    called_at: row.called_at,
    seated_at: row.seated_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    skipped_at: row.skipped_at,
    no_show_at: row.no_show_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapRpcError(
  error: { message?: string } | null,
): ReservationMutationResult {
  const message = error?.message ?? "";
  if (/RESERVATION_NOT_FOUND/i.test(message)) {
    return { ok: false, code: "NOT_FOUND", message: "Reservation not found." };
  }
  if (/RESERVATION_FORBIDDEN|42501|permission/i.test(message)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "You do not have permission for this reservation.",
    };
  }
  if (/RESERVATION_INVALID_TRANSITION/i.test(message)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "That status change is not allowed.",
    };
  }
  if (/RESERVATION_CONFLICT|already reserved/i.test(message)) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "That table is already reserved for this time.",
    };
  }
  if (/RESERVATION_TABLE_/i.test(message)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: message.replace(/^.*RESERVATION_TABLE_[A-Z_]+:\s*/i, ""),
    };
  }
  if (/duplicate key|unique/i.test(message)) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "A conflicting reservation already exists.",
    };
  }
  return {
    ok: false,
    code: "UNKNOWN",
    message: safeDatabaseMessage(error, "Unable to update reservation."),
  };
}

async function fetchBranch(branchId: string): Promise<Branch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select(BRANCH_SELECT)
    .eq("id", branchId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Branch;
}

async function loadAuthorizedBranch(
  branchId: string,
  permission: "reservations.view" | "reservations.manage",
) {
  // Fetch branch without nested membership (getBranch also checks membership).
  // Then enforce active restaurant + permission once.
  const auth = await requireVerifiedAuth();
  const branch = await fetchBranch(branchId);
  if (!branch) {
    return null;
  }

  if (auth.restaurant?.id !== branch.restaurant_id) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Branch does not belong to the active restaurant.",
    );
  }

  const context = await requirePermission(branch.restaurant_id, permission);
  return { context, branch };
}

async function loadAuthorizedReservation(
  reservationId: string,
  permission: "reservations.view" | "reservations.manage",
) {
  const auth = await requireVerifiedAuth();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const reservation = asReservationWithRelations(
    data as ReservationRowWithJoins,
  );
  const branch = await fetchBranch(reservation.branch_id);
  if (!branch) {
    return null;
  }

  const context = await requirePermission(branch.restaurant_id, permission);

  const scope = authorizeReservationScope({
    membershipRestaurantId: auth.restaurant?.id ?? "",
    reservationRestaurantId: branch.restaurant_id,
    currentRestaurantId: auth.restaurant?.id ?? "",
    reservationBranchId: reservation.branch_id,
    expectedBranchId: reservation.branch_id,
  });

  if (!scope.ok) {
    throw new AuthorizationError(
      "FORBIDDEN",
      scope.reason === "branch"
        ? "Reservation does not belong to this branch."
        : "Reservation does not belong to this restaurant.",
    );
  }

  return { context, branch, reservation };
}

async function loadTablesForBranch(
  branchId: string,
): Promise<
  Array<TableCandidate & { tableNumber: string; name: string | null }>
> {
  const supabase = await createClient();
  await releaseExpiredCleaningTables(supabase, branchId);
  const { data } = await supabase
    .from("restaurant_tables")
    .select("id, capacity, status, branch_id, table_number, name")
    .eq("branch_id", branchId)
    .order("table_number", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    capacity: row.capacity,
    status: row.status,
    branchId: row.branch_id,
    tableNumber: row.table_number,
    name: row.name,
  }));
}

async function loadExistingSlots(
  branchId: string,
  reservationDate: string,
): Promise<ExistingReservationSlot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select(
      "id, start_time, end_time, duration_minutes, party_size, table_id, status",
    )
    .eq("branch_id", branchId)
    .eq("reservation_date", reservationDate)
    .in("status", ["PENDING", "CONFIRMED", "ARRIVED", "SEATED"]);

  return (data ?? []).map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    partySize: row.party_size,
    tableId: row.table_id,
    status: row.status as ReservationStatus,
  }));
}

export async function checkReservationAvailability(
  input: AvailabilityQuery,
): Promise<{
  ok: boolean;
  issues: string[];
  message: string | null;
  suggestedTableIds: string[];
}> {
  const loaded = await loadAuthorizedBranch(
    input.branchId,
    "reservations.view",
  );
  if (!loaded) {
    return {
      ok: false,
      issues: ["NOT_FOUND"],
      message: "Branch not found.",
      suggestedTableIds: [],
    };
  }

  return evaluateReservationAvailability(input, {
    branch: loaded.branch,
    restaurantTimezone: loaded.context.membership.restaurant.timezone,
  });
}

async function evaluateReservationAvailability(
  input: AvailabilityQuery,
  preloaded: {
    branch: Branch;
    restaurantTimezone: string;
  },
): Promise<{
  ok: boolean;
  issues: string[];
  message: string | null;
  suggestedTableIds: string[];
}> {
  const [context, existing, tables] = await Promise.all([
    loadBranchOpenContext(input.branchId, {
      branch: preloaded.branch,
      restaurantTimezone: preloaded.restaurantTimezone,
    }),
    loadExistingSlots(input.branchId, input.reservationDate),
    loadTablesForBranch(input.branchId),
  ]);

  if (!context) {
    return {
      ok: false,
      issues: ["NOT_FOUND"],
      message: "Branch not found.",
      suggestedTableIds: [],
    };
  }

  const startTime = normalizeReservationTime(input.startTime);
  const endTime = resolveEndTime(startTime, input.durationMinutes);

  const result = evaluateAvailability({
    resolvedHours: resolveBranchHoursAt(context, input.reservationDate),
    timezone: context.timezone,
    branchId: input.branchId,
    slot: {
      reservationDate: input.reservationDate,
      startTime,
      endTime,
      partySize: input.partySize,
      tableId: input.tableId,
      excludeReservationId: input.excludeReservationId,
    },
    existing,
    tables,
    maxPartySize: 50,
  });

  return {
    ok: result.ok,
    issues: result.issues,
    message: result.ok ? null : availabilityMessage(result.issues),
    suggestedTableIds: result.suggestedTableIds,
  };
}

async function assertSlotAvailable(input: {
  branchId: string;
  reservationDate: string;
  startTime: string;
  durationMinutes: number;
  partySize: number;
  tableId?: string | null;
  excludeReservationId?: string;
  /** When set, skip a second auth/branch round-trip. */
  authorized?: {
    branch: Branch;
    restaurantTimezone: string;
  };
}): Promise<ReservationMutationResult | null> {
  const availability = input.authorized
    ? await evaluateReservationAvailability(input, input.authorized)
    : await checkReservationAvailability(input);

  if (!availability.ok) {
    const code: ReservationMutationCode =
      availability.issues.includes("OUTSIDE_HOURS") ||
      availability.issues.includes("CLOSED")
        ? "OUTSIDE_HOURS"
        : availability.issues.includes("TABLE_CONFLICT")
          ? "CONFLICT"
          : "VALIDATION";
    return {
      ok: false,
      code,
      message: availability.message ?? "Reservation is not available.",
    };
  }

  return null;
}

export const getReservationsBundle = cache(
  async (
    branchId: string,
    query: {
      view?: ReservationListQuery["view"];
      date?: string;
      status?: ReservationStatus;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<ReservationBundle> => {
    const loaded = await loadAuthorizedBranch(branchId, "reservations.view");
    if (!loaded) {
      throw new AuthorizationError(
        "FORBIDDEN",
        "Branch not found or inaccessible.",
      );
    }

    const timezone = resolveBranchTimezone({
      restaurantTimezone: loaded.context.membership.restaurant.timezone,
      branchTimezone: loaded.branch.timezone,
      useRestaurantTimezone: loaded.branch.use_restaurant_timezone,
    });
    const businessDate = getZonedDateParts(new Date(), timezone).date;
    const view = query.view ?? "today";
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    let statuses: ReservationStatus[] | null = null;

    if (view === "today") {
      dateFrom = query.date ?? businessDate;
      dateTo = dateFrom;
    } else if (view === "upcoming") {
      dateFrom = addCalendarDays(businessDate, 1);
      dateTo = addCalendarDays(businessDate, 60);
      statuses = ["PENDING", "CONFIRMED", "ARRIVED", "SEATED"];
    } else {
      dateFrom = addCalendarDays(businessDate, -90);
      dateTo = addCalendarDays(businessDate, -1);
      statuses = [...TERMINAL_RESERVATION_STATUSES];
    }

    if (query.date && view !== "today") {
      dateFrom = query.date;
      dateTo = query.date;
    }

    const supabase = await createClient();
    let dbQuery = supabase
      .from("reservations")
      .select(RESERVATION_SELECT, { count: "exact" })
      .eq("branch_id", branchId)
      .gte("reservation_date", dateFrom)
      .lte("reservation_date", dateTo)
      .order("reservation_date", { ascending: view !== "past" })
      .order("start_time", { ascending: view !== "past" });

    if (query.status) {
      dbQuery = dbQuery.eq("status", query.status);
    } else if (statuses) {
      dbQuery = dbQuery.in("status", statuses);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    dbQuery = dbQuery.range(from, to);

    const [reservationsResult, tables, queuesResult] = await Promise.all([
      dbQuery,
      loadTablesForBranch(branchId),
      supabase
        .from("queues")
        .select("id, name, status")
        .eq("branch_id", branchId)
        .order("name", { ascending: true }),
    ]);

    if (reservationsResult.error) {
      throw new Error(
        safeDatabaseMessage(
          reservationsResult.error,
          "Unable to load reservations.",
        ),
      );
    }

    let reservations = (reservationsResult.data ?? []).map((row) =>
      asReservationWithRelations(row as ReservationRowWithJoins),
    );

    if (query.search?.trim()) {
      reservations = reservations.filter((row) =>
        matchesReservationSearch(row, query.search!),
      );
    }

    const canManage = loaded.context.role
      ? canManageReservations(loaded.context.role)
      : false;

    const total = reservationsResult.count ?? reservations.length;
    return {
      branch: loaded.branch,
      timezone,
      businessDate,
      view,
      reservations,
      stats: deriveReservationStatistics(reservations),
      tables,
      queues: queuesResult.data ?? [],
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      canManage,
    };
  },
);

export async function getReservation(
  reservationId: string,
): Promise<ReservationWithRelations | null> {
  const loaded = await loadAuthorizedReservation(
    reservationId,
    "reservations.view",
  );
  return loaded?.reservation ?? null;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<ReservationMutationResult> {
  const loaded = await loadAuthorizedBranch(
    input.branchId,
    "reservations.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Branch not found." };
  }

  if (!loaded.branch.is_active) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Cannot create reservations for an inactive branch.",
    };
  }

  const customerResult = await resolveBookingCustomer(
    loaded.branch.restaurant_id,
    loaded.context.user.id,
    {
      customerId: input.customerId,
      name: input.name,
      phone: input.phone,
      email: input.email,
    },
    "reservation",
  );
  if (!customerResult.ok) {
    return customerResult;
  }

  const supabase = await createClient();
  const customerId = customerResult.customerId;

  const startTime = normalizeReservationTime(input.startTime);
  const durationMinutes = input.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const endTime = resolveEndTime(startTime, durationMinutes);

  const availabilityError = await assertSlotAvailable({
    branchId: input.branchId,
    reservationDate: input.reservationDate,
    startTime,
    durationMinutes,
    partySize: input.partySize,
    tableId: input.tableId,
    authorized: {
      branch: loaded.branch,
      restaurantTimezone: loaded.context.membership.restaurant.timezone,
    },
  });
  if (availabilityError) {
    return availabilityError;
  }

  if (input.tableId) {
    const { data: conflict } = await supabase.rpc(
      "reservation_table_has_conflict",
      {
        p_branch_id: input.branchId,
        p_table_id: input.tableId,
        p_date: input.reservationDate,
        p_start: startTime,
        p_end: endTime,
        p_exclude_id: null,
      },
    );
    if (conflict) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "That table is already reserved for this time.",
      };
    }
  }

  const { data: code, error: codeError } = await supabase.rpc(
    "allocate_reservation_code",
    { p_restaurant_id: loaded.branch.restaurant_id },
  );

  if (codeError || !code) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        codeError,
        "Unable to allocate reservation code.",
      ),
    };
  }

  const arrived = Boolean(input.arrived);
  const confirm = arrived || Boolean(input.confirm);
  const status: ReservationStatus = arrived
    ? input.tableId
      ? "SEATED"
      : "ARRIVED"
    : confirm
      ? "CONFIRMED"
      : "PENDING";
  const nowIso = new Date().toISOString();

  if (arrived && input.tableId) {
    const { data: table } = await supabase
      .from("restaurant_tables")
      .select("id, branch_id, capacity, status")
      .eq("id", input.tableId)
      .maybeSingle();

    if (!table || table.branch_id !== input.branchId) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Table not found for this branch.",
      };
    }
    if (table.status !== "AVAILABLE") {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Selected table is not available to seat the guest.",
      };
    }
    if (table.capacity < input.partySize) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Selected table cannot seat this party size.",
      };
    }

    const { data: occupied, error: tableError } = await supabase
      .from("restaurant_tables")
      .update({ status: "OCCUPIED" })
      .eq("id", input.tableId)
      .eq("branch_id", input.branchId)
      .eq("status", "AVAILABLE")
      .select("id")
      .maybeSingle();

    if (tableError || !occupied) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Unable to occupy the selected table.",
      };
    }
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      branch_id: input.branchId,
      customer_id: customerId,
      reservation_code: code,
      reservation_date: input.reservationDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      party_size: input.partySize,
      status,
      notes: input.notes ?? null,
      special_requests: input.specialRequests ?? null,
      table_id: input.tableId ?? null,
      created_by: loaded.context.user.id,
      confirmed_at: confirm ? nowIso : null,
      arrived_at: arrived ? nowIso : null,
      seated_at: status === "SEATED" ? nowIso : null,
    })
    .select(RESERVATION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return mapRpcError(error);
  }

  const reservation = asReservation(data as ReservationRow);

  if (input.tableId && !arrived) {
    await supabase
      .from("restaurant_tables")
      .update({ status: "RESERVED" })
      .eq("id", input.tableId)
      .eq("branch_id", input.branchId)
      .eq("status", "AVAILABLE");
  }

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "reservation.created",
    entityType: "reservation",
    entityId: reservation.id,
    metadata: {
      branchId: input.branchId,
      status: reservation.status,
      partySize: reservation.party_size,
      reservationCode: reservation.reservation_code,
      hasTable: Boolean(reservation.table_id),
      arrived,
    },
  });

  notifyReservationCreated(reservation.id);
  if (confirm) {
    notifyReservationConfirmed(reservation.id);
  }
  if (status === "ARRIVED") {
    notifyReservationArrived(reservation.id);
  }
  if (status === "SEATED") {
    notifyReservationArrived(reservation.id);
    notifyReservationSeated(reservation.id);
  }

  return { ok: true, reservation };
}

export async function updateReservation(
  input: UpdateReservationInput,
): Promise<ReservationMutationResult> {
  const loaded = await loadAuthorizedReservation(
    input.reservationId,
    "reservations.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Reservation not found." };
  }

  if (
    loaded.reservation.status === "COMPLETED" ||
    loaded.reservation.status === "CANCELLED" ||
    loaded.reservation.status === "NO_SHOW" ||
    loaded.reservation.status === "SEATED"
  ) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "This reservation can no longer be edited.",
    };
  }

  const startTime = normalizeReservationTime(
    input.startTime ?? loaded.reservation.start_time,
  );
  const durationMinutes =
    input.durationMinutes ?? loaded.reservation.duration_minutes;
  const reservationDate =
    input.reservationDate ?? loaded.reservation.reservation_date;
  const partySize = input.partySize ?? loaded.reservation.party_size;
  const tableId =
    input.tableId === undefined ? loaded.reservation.table_id : input.tableId;
  const endTime = resolveEndTime(startTime, durationMinutes);

  const availabilityError = await assertSlotAvailable({
    branchId: loaded.reservation.branch_id,
    reservationDate,
    startTime,
    durationMinutes,
    partySize,
    tableId,
    excludeReservationId: loaded.reservation.id,
    authorized: {
      branch: loaded.branch,
      restaurantTimezone: loaded.context.membership.restaurant.timezone,
    },
  });
  if (availabilityError) {
    return availabilityError;
  }

  if (input.customerId) {
    const supabaseCheck = await createClient();
    const { data: customer } = await supabaseCheck
      .from("customers")
      .select("id, restaurant_id")
      .eq("id", input.customerId)
      .maybeSingle();
    if (!customer || customer.restaurant_id !== loaded.branch.restaurant_id) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Customer does not belong to this restaurant.",
      };
    }
  }

  const supabase = await createClient();
  const previousTableId = loaded.reservation.table_id;

  const { data, error } = await supabase
    .from("reservations")
    .update({
      reservation_date: reservationDate,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      party_size: partySize,
      table_id: tableId,
      notes: input.notes === undefined ? undefined : input.notes,
      special_requests:
        input.specialRequests === undefined ? undefined : input.specialRequests,
      customer_id: input.customerId ?? undefined,
    })
    .eq("id", loaded.reservation.id)
    .eq("branch_id", loaded.reservation.branch_id)
    .select(RESERVATION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return mapRpcError(error);
  }

  const reservation = asReservation(data as ReservationRow);

  if (previousTableId && previousTableId !== tableId) {
    await supabase
      .from("restaurant_tables")
      .update({ status: "AVAILABLE" })
      .eq("id", previousTableId)
      .eq("status", "RESERVED");
  }

  if (tableId && tableId !== previousTableId) {
    await supabase
      .from("restaurant_tables")
      .update({ status: "RESERVED" })
      .eq("id", tableId)
      .eq("branch_id", loaded.reservation.branch_id)
      .eq("status", "AVAILABLE");
  }

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "reservation.updated",
    entityType: "reservation",
    entityId: reservation.id,
    metadata: {
      branchId: reservation.branch_id,
      partySize: reservation.party_size,
      hasTable: Boolean(reservation.table_id),
    },
  });

  return { ok: true, reservation };
}

async function transitionReservation(
  reservationId: string,
  toStatus: ReservationStatus,
  options?: {
    tableId?: string | null;
    cancelledReason?: string | null;
    auditAction:
      | "reservation.confirmed"
      | "reservation.cancelled"
      | "reservation.arrived"
      | "reservation.seated"
      | "reservation.completed"
      | "reservation.no_show";
    notify?: "confirmed" | "cancelled" | "arrived" | "seated" | "no_show";
  },
): Promise<ReservationMutationResult> {
  const loaded = await loadAuthorizedReservation(
    reservationId,
    "reservations.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Reservation not found." };
  }

  if (
    !canTransitionReservationStatus(loaded.reservation.status, toStatus) &&
    loaded.reservation.status !== toStatus
  ) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Cannot change from ${loaded.reservation.status} to ${toStatus}.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_transition", {
    p_reservation_id: reservationId,
    p_to_status: toStatus,
    p_table_id: options?.tableId ?? null,
    p_cancelled_reason: options?.cancelledReason ?? null,
  });

  if (error || !data) {
    return mapRpcError(error);
  }

  const reservation = asReservation(data as ReservationRow);

  if (options?.auditAction) {
    await writeAuditLog({
      restaurantId: loaded.branch.restaurant_id,
      userId: loaded.context.user.id,
      action: options.auditAction,
      entityType: "reservation",
      entityId: reservation.id,
      metadata: {
        branchId: reservation.branch_id,
        from: loaded.reservation.status,
        to: reservation.status,
        hasTable: Boolean(reservation.table_id),
      },
    });
  }

  if (options?.notify) {
    if (options.notify === "confirmed") {
      notifyReservationConfirmed(reservation.id);
    } else if (options.notify === "cancelled") {
      notifyReservationCancelled(reservation.id);
    } else if (options.notify === "arrived") {
      notifyReservationArrived(reservation.id);
    } else if (options.notify === "seated") {
      notifyReservationSeated(reservation.id);
    } else if (options.notify === "no_show") {
      notifyReservationNoShow(reservation.id);
    }
  }

  return { ok: true, reservation };
}

export async function confirmReservation(
  reservationId: string,
): Promise<ReservationMutationResult> {
  return transitionReservation(reservationId, "CONFIRMED", {
    auditAction: "reservation.confirmed",
    notify: "confirmed",
  });
}

export async function cancelReservation(
  input: CancelReservationInput,
): Promise<ReservationMutationResult> {
  return transitionReservation(input.reservationId, "CANCELLED", {
    cancelledReason: input.reason,
    auditAction: "reservation.cancelled",
    notify: "cancelled",
  });
}

export async function markReservationArrived(
  reservationId: string,
): Promise<ReservationMutationResult> {
  return transitionReservation(reservationId, "ARRIVED", {
    auditAction: "reservation.arrived",
    notify: "arrived",
  });
}

export async function assignReservationTable(
  input: AssignReservationTableInput,
): Promise<ReservationMutationResult> {
  const loaded = await loadAuthorizedReservation(
    input.reservationId,
    "reservations.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Reservation not found." };
  }

  if (
    loaded.reservation.status === "COMPLETED" ||
    loaded.reservation.status === "CANCELLED" ||
    loaded.reservation.status === "NO_SHOW"
  ) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Cannot assign a table to this reservation.",
    };
  }

  const availabilityError = await assertSlotAvailable({
    branchId: loaded.reservation.branch_id,
    reservationDate: loaded.reservation.reservation_date,
    startTime: loaded.reservation.start_time,
    durationMinutes: loaded.reservation.duration_minutes,
    partySize: loaded.reservation.party_size,
    tableId: input.tableId,
    excludeReservationId: loaded.reservation.id,
    authorized: {
      branch: loaded.branch,
      restaurantTimezone: loaded.context.membership.restaurant.timezone,
    },
  });
  if (availabilityError) {
    return availabilityError;
  }

  const supabase = await createClient();
  const previousTableId = loaded.reservation.table_id;

  const { data, error } = await supabase
    .from("reservations")
    .update({ table_id: input.tableId })
    .eq("id", loaded.reservation.id)
    .select(RESERVATION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return mapRpcError(error);
  }

  if (previousTableId && previousTableId !== input.tableId) {
    await supabase
      .from("restaurant_tables")
      .update({ status: "AVAILABLE" })
      .eq("id", previousTableId)
      .eq("status", "RESERVED");
  }

  if (loaded.reservation.status !== "SEATED") {
    await supabase
      .from("restaurant_tables")
      .update({ status: "RESERVED" })
      .eq("id", input.tableId)
      .eq("branch_id", loaded.reservation.branch_id)
      .in("status", ["AVAILABLE", "RESERVED"]);
  }

  const reservation = asReservation(data as ReservationRow);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "reservation.table_assigned",
    entityType: "reservation",
    entityId: reservation.id,
    metadata: {
      branchId: reservation.branch_id,
      tableId: input.tableId,
    },
  });

  return { ok: true, reservation };
}

export async function seatReservation(
  input: SeatReservationInput,
): Promise<ReservationMutationResult> {
  return transitionReservation(input.reservationId, "SEATED", {
    tableId: input.tableId,
    auditAction: "reservation.seated",
    notify: "seated",
  });
}

export async function completeReservation(
  reservationId: string,
): Promise<ReservationMutationResult> {
  return transitionReservation(reservationId, "COMPLETED", {
    auditAction: "reservation.completed",
  });
}

export async function markReservationNoShow(
  reservationId: string,
): Promise<ReservationMutationResult> {
  return transitionReservation(reservationId, "NO_SHOW", {
    auditAction: "reservation.no_show",
    notify: "no_show",
  });
}

export async function convertReservationToQueue(
  input: ConvertReservationToQueueInput,
): Promise<ConvertToQueueResult> {
  const loaded = await loadAuthorizedReservation(
    input.reservationId,
    "reservations.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Reservation not found." };
  }

  if (
    loaded.reservation.status !== "ARRIVED" &&
    loaded.reservation.status !== "CONFIRMED"
  ) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Only confirmed or arrived reservations can join the queue.",
    };
  }

  if (!loaded.reservation.customer_id) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Reservation has no customer to queue.",
    };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("reservation_id", loaded.reservation.id)
    .in("status", ["WAITING", "CALLED", "SEATED"])
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "This reservation already has an active queue entry.",
    };
  }

  const { data: queue } = await supabase
    .from("queues")
    .select("id, branch_id")
    .eq("id", input.queueId)
    .maybeSingle();

  if (!queue || queue.branch_id !== loaded.reservation.branch_id) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Queue not found for this branch.",
    };
  }

  // Ensure arrived before queueing when still confirmed
  if (loaded.reservation.status === "CONFIRMED") {
    const arrived = await markReservationArrived(loaded.reservation.id);
    if (!arrived.ok) {
      return arrived;
    }
  }

  const { data, error } = await supabase.rpc("queue_enqueue_customer", {
    p_queue_id: input.queueId,
    p_party_size: loaded.reservation.party_size,
    p_customer_id: loaded.reservation.customer_id,
    p_customer_name: null,
    p_customer_phone: null,
    p_customer_email: null,
  });

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to add reservation to queue.",
      ),
    };
  }

  const entryRow = data as Tables<"queue_entries">;
  const { data: linked, error: linkError } = await supabase
    .from("queue_entries")
    .update({ reservation_id: loaded.reservation.id })
    .eq("id", entryRow.id)
    .is("reservation_id", null)
    .select("*")
    .maybeSingle();

  if (linkError || !linked) {
    // Race: another worker linked first — treat as conflict if already linked
    const { data: raced } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("id", entryRow.id)
      .maybeSingle();
    if (raced?.reservation_id === loaded.reservation.id) {
      // ok
    } else {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Unable to link queue entry to reservation.",
      };
    }
  }

  const entry = asQueueEntry(linked ?? entryRow);
  const refreshed = await loadAuthorizedReservation(
    loaded.reservation.id,
    "reservations.view",
  );

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "reservation.converted_to_queue",
    entityType: "reservation",
    entityId: loaded.reservation.id,
    metadata: {
      branchId: loaded.reservation.branch_id,
      queueId: input.queueId,
      queueEntryId: entry.id,
    },
  });

  scheduleNotificationWork(async () => {
    const { notifyQueueJoined } = await import("@/lib/notifications/queue");
    await notifyQueueJoined(entry.id);
  });

  return {
    ok: true,
    entry,
    reservation: asReservationFromWithRelations(
      refreshed?.reservation ?? loaded.reservation,
    ),
  };
}

function asReservationFromWithRelations(
  row: ReservationWithRelations,
): ReservationRecord {
  return {
    id: row.id,
    branch_id: row.branch_id,
    customer_id: row.customer_id,
    reservation_code: row.reservation_code,
    reservation_date: row.reservation_date,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    party_size: row.party_size,
    status: row.status,
    notes: row.notes,
    special_requests: row.special_requests,
    cancelled_reason: row.cancelled_reason,
    table_id: row.table_id,
    created_by: row.created_by,
    confirmed_at: row.confirmed_at,
    arrived_at: row.arrived_at,
    seated_at: row.seated_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    no_show_at: row.no_show_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function resolveBookingCustomer(
  restaurantId: string,
  userId: string,
  input: {
    customerId?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  source: "walk_in" | "reservation",
): Promise<
  | { ok: true; customerId: string }
  | { ok: false; message: string; code: ReservationMutationCode }
> {
  const supabase = await createClient();

  if (input.customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, restaurant_id")
      .eq("id", input.customerId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, code: "NOT_FOUND", message: "Customer not found." };
    }
    if (data.restaurant_id !== restaurantId) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Customer does not belong to this restaurant.",
      };
    }
    return { ok: true, customerId: data.id };
  }

  const duplicate = await findPotentialDuplicateCustomer(restaurantId, {
    phone: input.phone ?? null,
    email: input.email ?? null,
  });
  if (duplicate) {
    return { ok: true, customerId: duplicate.id };
  }

  const name = input.name?.trim() ?? "";
  if (!name) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Customer name is required.",
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      restaurant_id: restaurantId,
      name,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const raced = await findPotentialDuplicateCustomer(restaurantId, {
      phone: input.phone ?? null,
      email: input.email ?? null,
    });
    if (raced) {
      return { ok: true, customerId: raced.id };
    }
    return {
      ok: false,
      code: /duplicate key|unique/i.test(error?.message ?? "")
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create customer. Please try again.",
      ),
    };
  }

  await writeAuditLog({
    restaurantId,
    userId,
    action: "customer.created",
    entityType: "customer",
    entityId: data.id,
    metadata: {
      source,
      hasPhone: Boolean(input.phone),
      hasEmail: Boolean(input.email),
    },
  });

  return { ok: true, customerId: data.id };
}

async function resolveWalkInCustomer(
  restaurantId: string,
  userId: string,
  input: CreateWalkInInput,
): Promise<
  | { ok: true; customerId: string }
  | { ok: false; message: string; code: ReservationMutationCode }
> {
  return resolveBookingCustomer(restaurantId, userId, input, "walk_in");
}

export async function createWalkIn(
  input: CreateWalkInInput,
): Promise<WalkInMutationResult> {
  const loaded = await loadAuthorizedBranch(
    input.branchId,
    "reservations.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Branch not found." };
  }

  // Walk-ins also require queue.manage or tables.manage depending on mode
  if (input.mode === "queue") {
    await requirePermission(loaded.branch.restaurant_id, "queue.manage");
  } else {
    await requirePermission(loaded.branch.restaurant_id, "tables.manage");
  }

  const customerResult = await resolveWalkInCustomer(
    loaded.branch.restaurant_id,
    loaded.context.user.id,
    input,
  );
  if (!customerResult.ok) {
    return customerResult;
  }

  const supabase = await createClient();

  if (input.mode === "seat") {
    const tableId = input.tableId!;
    const { data: table } = await supabase
      .from("restaurant_tables")
      .select("id, branch_id, capacity, status")
      .eq("id", tableId)
      .maybeSingle();

    if (!table || table.branch_id !== input.branchId) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Table not found for this branch.",
      };
    }
    if (table.status === "BLOCKED" || table.status === "OCCUPIED") {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Selected table is not available.",
      };
    }
    if (table.capacity < input.partySize) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Selected table cannot seat this party size.",
      };
    }

    const { error: tableError } = await supabase
      .from("restaurant_tables")
      .update({ status: "OCCUPIED" })
      .eq("id", tableId)
      .eq("branch_id", input.branchId)
      .in("status", ["AVAILABLE", "RESERVED"]);

    if (tableError) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Unable to seat walk-in at that table.",
      };
    }

    await writeAuditLog({
      restaurantId: loaded.branch.restaurant_id,
      userId: loaded.context.user.id,
      action: "walk_in.seated",
      entityType: "customer",
      entityId: customerResult.customerId,
      metadata: {
        branchId: input.branchId,
        tableId,
        partySize: input.partySize,
      },
    });

    return {
      ok: true,
      mode: "seat",
      customerId: customerResult.customerId,
      tableId,
    };
  }

  const queueId = input.queueId!;
  const { data: queue } = await supabase
    .from("queues")
    .select("id, branch_id")
    .eq("id", queueId)
    .maybeSingle();

  if (!queue || queue.branch_id !== input.branchId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Queue not found for this branch.",
    };
  }

  const { data, error } = await supabase.rpc("queue_enqueue_customer", {
    p_queue_id: queueId,
    p_party_size: input.partySize,
    p_customer_id: customerResult.customerId,
    p_customer_name: null,
    p_customer_phone: null,
    p_customer_email: null,
  });

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(error, "Unable to add walk-in to queue."),
    };
  }

  const entry = asQueueEntry(data as Tables<"queue_entries">);

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "walk_in.created",
    entityType: "queue_entry",
    entityId: entry.id,
    metadata: {
      branchId: input.branchId,
      queueId,
      partySize: input.partySize,
      customerId: customerResult.customerId,
    },
  });

  scheduleNotificationWork(async () => {
    const { notifyQueueJoined } = await import("@/lib/notifications/queue");
    await notifyQueueJoined(entry.id);
  });

  return {
    ok: true,
    mode: "queue",
    entry,
    customerId: customerResult.customerId,
  };
}

export async function getCustomerReservationHistory(
  customerId: string,
): Promise<CustomerReservationHistory> {
  const context = await requireVerifiedAuth();
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, restaurant_id")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    return summarizeCustomerReservations([]);
  }

  await requirePermission(customer.restaurant_id, "customers.view");
  if (context.restaurant?.id !== customer.restaurant_id) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Customer does not belong to this restaurant.",
    );
  }

  const { data } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, reservation_date, start_time, party_size, status, branch_id",
    )
    .eq("customer_id", customerId)
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(100);

  return summarizeCustomerReservations(
    (data ?? []).map((row) => ({
      ...row,
      status: row.status as ReservationStatus,
    })),
  );
}

export type { CustomerRecord, Json };
