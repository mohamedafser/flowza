import { buildIdempotencyKey } from "@/lib/notifications/constants";
import {
  scheduleNotificationWork,
  sendNotification,
} from "@/lib/notifications/service";
import type {
  NotificationChannel,
  ReservationNotificationTemplateData,
} from "@/lib/notifications/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatReservationTime } from "@/lib/utils/reservations";
import type { ReservationRecord } from "@/lib/utils/reservations";

export type ReservationNotificationContext = {
  restaurantId: string;
  restaurantName: string;
  branchId: string;
  branchName: string;
  reservation: ReservationRecord;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  tableName: string | null;
};

async function loadReservationNotificationContext(
  reservationId: string,
): Promise<ReservationNotificationContext | null> {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());

  const { data: reservation, error } = await client
    .from("reservations")
    .select(
      "id, branch_id, customer_id, reservation_code, reservation_date, start_time, end_time, duration_minutes, party_size, status, notes, special_requests, cancelled_reason, table_id, created_by, confirmed_at, arrived_at, seated_at, completed_at, cancelled_at, no_show_at, created_at, updated_at",
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !reservation) {
    return null;
  }

  const { data: branch } = await client
    .from("branches")
    .select("id, name, restaurant_id")
    .eq("id", reservation.branch_id)
    .maybeSingle();

  if (!branch) {
    return null;
  }

  const { data: restaurant } = await client
    .from("restaurants")
    .select("id, name")
    .eq("id", branch.restaurant_id)
    .maybeSingle();

  if (!restaurant) {
    return null;
  }

  let customer: ReservationNotificationContext["customer"] = null;
  if (reservation.customer_id) {
    const { data: customerRow } = await client
      .from("customers")
      .select("id, name, phone, email")
      .eq("id", reservation.customer_id)
      .maybeSingle();
    if (customerRow) {
      customer = customerRow;
    }
  }

  let tableName: string | null = null;
  if (reservation.table_id) {
    const { data: table } = await client
      .from("restaurant_tables")
      .select("table_number, name")
      .eq("id", reservation.table_id)
      .maybeSingle();
    if (table) {
      tableName = table.name
        ? `${table.table_number} (${table.name})`
        : table.table_number;
    }
  }

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    branchId: branch.id,
    branchName: branch.name,
    reservation: reservation as ReservationRecord,
    customer,
    tableName,
  };
}

function templateData(
  ctx: ReservationNotificationContext,
): ReservationNotificationTemplateData {
  return {
    customerName: ctx.customer?.name ?? "Guest",
    restaurantName: ctx.restaurantName,
    branchName: ctx.branchName,
    reservationCode: ctx.reservation.reservation_code ?? "RES",
    partySize: ctx.reservation.party_size,
    reservationDate: ctx.reservation.reservation_date,
    reservationTime: formatReservationTime(ctx.reservation.start_time),
    tableName: ctx.tableName,
  };
}

function reservationIdempotencyKey(input: {
  reservationId: string;
  type: string;
  channel: NotificationChannel;
  eventVersion: string;
}): string {
  return buildIdempotencyKey({
    queueEntryId: `reservation:${input.reservationId}`,
    type: input.type as never,
    channel: input.channel,
    eventVersion: input.eventVersion,
  });
}

async function dispatchReservationEvent(
  reservationId: string,
  type:
    | "RESERVATION_CREATED"
    | "RESERVATION_CONFIRMED"
    | "RESERVATION_CANCELLED"
    | "RESERVATION_ARRIVED"
    | "RESERVATION_SEATED"
    | "RESERVATION_NO_SHOW",
  staffType?:
    | "STAFF_RESERVATION_CREATED"
    | "STAFF_RESERVATION_CANCELLED"
    | "STAFF_RESERVATION_NO_SHOW",
  eventVersion = "v1",
): Promise<void> {
  const ctx = await loadReservationNotificationContext(reservationId);
  if (!ctx) return;

  const data = templateData(ctx);
  const channels: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP", "IN_APP"];

  for (const channel of channels) {
    let recipient: string | null = null;
    if (channel === "EMAIL") {
      recipient = ctx.customer?.email ?? null;
    } else if (channel === "SMS" || channel === "WHATSAPP") {
      recipient = ctx.customer?.phone ?? null;
    } else if (channel === "IN_APP") {
      recipient = ctx.customer?.id ?? null;
    }

    if (!recipient) continue;

    await sendNotification({
      restaurantId: ctx.restaurantId,
      customerId: ctx.customer?.id ?? null,
      reservationId: ctx.reservation.id,
      branchId: ctx.branchId,
      type,
      channel,
      audience: "CUSTOMER",
      idempotencyKey: reservationIdempotencyKey({
        reservationId: ctx.reservation.id,
        type,
        channel,
        eventVersion,
      }),
      recipient,
      data,
    });
  }

  if (staffType) {
    await sendNotification({
      restaurantId: ctx.restaurantId,
      customerId: ctx.customer?.id ?? null,
      reservationId: ctx.reservation.id,
      branchId: ctx.branchId,
      type: staffType,
      channel: "IN_APP",
      audience: "STAFF",
      idempotencyKey: reservationIdempotencyKey({
        reservationId: ctx.reservation.id,
        type: staffType,
        channel: "IN_APP",
        eventVersion,
      }),
      recipient: ctx.restaurantId,
      data,
      bypassPreferences: true,
    });
  }
}

export function notifyReservationCreated(reservationId: string): void {
  scheduleNotificationWork(() =>
    dispatchReservationEvent(
      reservationId,
      "RESERVATION_CREATED",
      "STAFF_RESERVATION_CREATED",
    ),
  );
}

export function notifyReservationConfirmed(reservationId: string): void {
  scheduleNotificationWork(() =>
    dispatchReservationEvent(reservationId, "RESERVATION_CONFIRMED"),
  );
}

export function notifyReservationCancelled(reservationId: string): void {
  scheduleNotificationWork(() =>
    dispatchReservationEvent(
      reservationId,
      "RESERVATION_CANCELLED",
      "STAFF_RESERVATION_CANCELLED",
    ),
  );
}

export function notifyReservationArrived(reservationId: string): void {
  scheduleNotificationWork(() =>
    dispatchReservationEvent(reservationId, "RESERVATION_ARRIVED"),
  );
}

export function notifyReservationSeated(reservationId: string): void {
  scheduleNotificationWork(() =>
    dispatchReservationEvent(reservationId, "RESERVATION_SEATED"),
  );
}

export function notifyReservationNoShow(reservationId: string): void {
  scheduleNotificationWork(() =>
    dispatchReservationEvent(
      reservationId,
      "RESERVATION_NO_SHOW",
      "STAFF_RESERVATION_NO_SHOW",
    ),
  );
}
