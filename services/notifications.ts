import {
  requirePermission,
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

type NotificationRow = Pick<
  Tables<"notifications">,
  | "id"
  | "type"
  | "title"
  | "body"
  | "created_at"
  | "queue_entry_id"
  | "branch_id"
>;

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

const STAFF_UNREAD_WINDOW = 100;

/**
 * Unread among the most recent staff IN_APP notifications for this restaurant.
 * Scoped read lookup avoids loading every notification_reads row for the user.
 */
async function computeStaffUnreadCount(input: {
  restaurantId: string;
  userId: string;
}): Promise<number> {
  const supabase = await createClient();
  const { data: recentStaff } = await supabase
    .from("notifications")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(STAFF_UNREAD_WINDOW);

  const ids = (recentStaff ?? []).map((row) => row.id);
  if (ids.length === 0) return 0;

  const { data: reads } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", input.userId)
    .in("notification_id", ids);

  const readIds = new Set((reads ?? []).map((row) => row.notification_id));
  return ids.filter((id) => !readIds.has(id)).length;
}

/**
 * List staff in-app notifications for the current user in a restaurant.
 * Never returns customer email/phone — only title/body already stored.
 */
export async function listStaffNotifications(input: {
  restaurantId: string;
  cursor?: string | null;
  limit?: number;
  /** When true, skip the page query and return unreadCount only. */
  unreadOnly?: boolean;
}): Promise<StaffNotificationList> {
  // Single auth path — requirePermission already verifies membership.
  const auth = await requirePermission(input.restaurantId, "queue.view");
  const supabase = await createClient();

  if (input.unreadOnly) {
    const unreadCount = await computeStaffUnreadCount({
      restaurantId: input.restaurantId,
      userId: auth.user.id,
    });
    return { items: [], unreadCount, nextCursor: null };
  }

  const limit = Math.min(
    Math.max(input.limit ?? STAFF_NOTIFICATION_PAGE_SIZE, 1),
    50,
  );

  let query = supabase
    .from("notifications")
    .select(
      "id, type, title, body, created_at, queue_entry_id, branch_id",
    )
    .eq("restaurant_id", input.restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (input.cursor) {
    query = query.lt("created_at", input.cursor);
  }

  const [{ data: rows, error }, unreadCount] = await Promise.all([
    query,
    computeStaffUnreadCount({
      restaurantId: input.restaurantId,
      userId: auth.user.id,
    }),
  ]);

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

  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;

  return {
    items: page.map((row) => mapItem(row, readMap.get(row.id) ?? null)),
    unreadCount,
    nextCursor,
  };
}

export async function markStaffNotificationRead(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id, restaurant_id, audience")
    .eq("id", notificationId)
    .maybeSingle();

  if (error || !notification) {
    return { ok: false, message: "Notification not found." };
  }

  if (notification.audience !== "STAFF") {
    return { ok: false, message: "Notification not found." };
  }

  const auth = await requirePermission(notification.restaurant_id, "queue.view");

  const { error: upsertError } = await supabase.from("notification_reads").upsert(
    {
      notification_id: notification.id,
      user_id: auth.user.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id" },
  );

  if (upsertError) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "mark_read_failed",
        error: upsertError.message,
        code: upsertError.code,
      }),
    );
    return { ok: false, message: "Unable to mark notification as read." };
  }

  return { ok: true };
}

export async function markAllStaffNotificationsRead(
  restaurantId: string,
): Promise<{ ok: true; marked: number } | { ok: false; message: string }> {
  const auth = await requirePermission(restaurantId, "queue.view");
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("audience", "STAFF")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(STAFF_UNREAD_WINDOW);

  if (error) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "mark_all_read_list_failed",
        error: error.message,
        code: error.code,
      }),
    );
    return { ok: false, message: "Unable to mark notifications as read." };
  }

  const ids = (rows ?? []).map((row) => row.id);
  if (ids.length === 0) {
    return { ok: true, marked: 0 };
  }

  const { data: existingReads, error: readsError } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", auth.user.id)
    .in("notification_id", ids);

  if (readsError) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "mark_all_read_reads_failed",
        error: readsError.message,
        code: readsError.code,
      }),
    );
    return { ok: false, message: "Unable to mark notifications as read." };
  }

  const alreadyRead = new Set(
    (existingReads ?? []).map((row) => row.notification_id),
  );
  const unreadIds = ids.filter((id) => !alreadyRead.has(id));

  if (unreadIds.length === 0) {
    return { ok: true, marked: 0 };
  }

  const now = new Date().toISOString();
  // Insert only — notification_reads RLS has no UPDATE policy, so upsert
  // fails when some rows were already marked read.
  const { error: insertError } = await supabase.from("notification_reads").insert(
    unreadIds.map((notificationId) => ({
      notification_id: notificationId,
      user_id: auth.user.id,
      read_at: now,
    })),
  );

  if (insertError) {
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "mark_all_read_insert_failed",
        error: insertError.message,
        code: insertError.code,
      }),
    );
    return { ok: false, message: "Unable to mark notifications as read." };
  }

  return { ok: true, marked: unreadIds.length };
}

export async function getStaffUnreadCount(
  restaurantId: string,
): Promise<number> {
  const list = await listStaffNotifications({
    restaurantId,
    unreadOnly: true,
  });
  return list.unreadCount;
}
