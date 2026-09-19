import {
  requirePermission,
  requireRestaurantMembership,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import { STAFF_NOTIFICATION_PAGE_SIZE } from "@/lib/notifications/constants";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type StaffNotificationItem = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  queueEntryId: string | null;
  branchId: string | null;
  readAt: string | null;
};

export type StaffNotificationList = {
  items: StaffNotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};

type NotificationRow = Tables<"notifications">;

function mapItem(
  row: NotificationRow,
  readAt: string | null,
): StaffNotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    queueEntryId: row.queue_entry_id,
    branchId: row.branch_id,
    readAt,
  };
}

/**
 * List staff in-app notifications for the current user in a restaurant.
 * Never returns customer email/phone — only title/body already stored.
 */
export async function listStaffNotifications(input: {
  restaurantId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<StaffNotificationList> {
  const auth = await requireVerifiedAuth();
  await requireRestaurantMembership(input.restaurantId);
  await requirePermission(input.restaurantId, "queue.view");

  const limit = Math.min(
    Math.max(input.limit ?? STAFF_NOTIFICATION_PAGE_SIZE, 1),
    50,
  );
  const supabase = await createClient();

  let query = supabase
    .from("notifications")
    .select(
      "id, type, title, body, created_at, queue_entry_id, branch_id, restaurant_id, audience, channel",
    )
    .eq("restaurant_id", input.restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (input.cursor) {
    query = query.lt("created_at", input.cursor);
  }

  const { data: rows, error } = await query;
  if (error || !rows) {
    return { items: [], unreadCount: 0, nextCursor: null };
  }

  const page = rows.slice(0, limit);
  const ids = page.map((row) => row.id);

  const readMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: reads } = await supabase
      .from("notification_reads")
      .select("notification_id, read_at")
      .eq("user_id", auth.user.id)
      .in("notification_id", ids);

    for (const read of reads ?? []) {
      readMap.set(read.notification_id, read.read_at);
    }
  }

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", input.restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP");

  const { data: allReads } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", auth.user.id);

  const readIds = new Set((allReads ?? []).map((r) => r.notification_id));

  // Unread = staff notifications without a read row for this user.
  // Approximate via count - intersection would need a join; fetch recent unread ids.
  const { data: recentStaff } = await supabase
    .from("notifications")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(100);

  const unreadCount = (recentStaff ?? []).filter(
    (row) => !readIds.has(row.id),
  ).length;

  void count;

  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;

  return {
    items: page.map((row) =>
      mapItem(row as NotificationRow, readMap.get(row.id) ?? null),
    ),
    unreadCount,
    nextCursor,
  };
}

export async function markStaffNotificationRead(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = await requireVerifiedAuth();
  const supabase = await createClient();

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id, restaurant_id, audience")
    .eq("id", notificationId)
    .maybeSingle();

  if (error || !notification) {
    return { ok: false, message: "Notification not found." };
  }

  await requireRestaurantMembership(notification.restaurant_id);

  if (notification.audience !== "STAFF") {
    return { ok: false, message: "Notification not found." };
  }

  const { error: upsertError } = await supabase.from("notification_reads").upsert(
    {
      notification_id: notification.id,
      user_id: auth.user.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id" },
  );

  if (upsertError) {
    return { ok: false, message: "Unable to mark notification as read." };
  }

  return { ok: true };
}

export async function markAllStaffNotificationsRead(
  restaurantId: string,
): Promise<{ ok: true; marked: number } | { ok: false; message: string }> {
  const auth = await requireVerifiedAuth();
  await requireRestaurantMembership(restaurantId);
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !rows) {
    return { ok: false, message: "Unable to mark notifications as read." };
  }

  if (rows.length === 0) {
    return { ok: true, marked: 0 };
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await supabase.from("notification_reads").upsert(
    rows.map((row) => ({
      notification_id: row.id,
      user_id: auth.user.id,
      read_at: now,
    })),
    { onConflict: "notification_id,user_id" },
  );

  if (upsertError) {
    return { ok: false, message: "Unable to mark notifications as read." };
  }

  return { ok: true, marked: rows.length };
}

export async function getStaffUnreadCount(
  restaurantId: string,
): Promise<number> {
  const list = await listStaffNotifications({
    restaurantId,
    limit: 1,
  });
  return list.unreadCount;
}
