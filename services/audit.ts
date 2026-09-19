import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export type AuditAction =
  | "restaurant.created"
  | "restaurant.updated"
  | "restaurant.logo_updated"
  | "restaurant.settings_updated"
  | "restaurant.queue_settings_updated"
  | "restaurant.customer_settings_updated"
  | "restaurant.notification_settings_updated"
  | "branch.created"
  | "branch.updated"
  | "branch.activated"
  | "branch.deactivated"
  | "operating_hours.updated"
  | "branch_hours.updated"
  | "special_hours.created"
  | "special_hours.updated"
  | "special_hours.deleted"
  | "table.created"
  | "table.updated"
  | "table.status_changed"
  | "table.deleted"
  | "table_section.created"
  | "table_section.updated"
  | "table_section.deleted"
  | "table_section.reordered"
  | "customer.created"
  | "customer.updated"
  | "queue.created"
  | "queue.updated"
  | "queue.paused"
  | "queue.resumed"
  | "queue.closed"
  | "queue.entry_joined"
  | "queue.entry_called"
  | "queue.entry_skipped"
  | "queue.entry_cancelled"
  | "queue.entry_no_show"
  | "queue.entry_seated"
  | "queue.entry_completed"
  | "display.created"
  | "display.updated"
  | "display.activated"
  | "display.deactivated"
  | "display.deleted"
  | "qr_code.created"
  | "qr_code.updated"
  | "qr_code.activated"
  | "qr_code.deactivated"
  | "qr_code.token_regenerated"
  | "reservation.created"
  | "reservation.updated"
  | "reservation.confirmed"
  | "reservation.cancelled"
  | "reservation.arrived"
  | "reservation.seated"
  | "reservation.completed"
  | "reservation.no_show"
  | "reservation.table_assigned"
  | "reservation.converted_to_queue"
  | "walk_in.created"
  | "walk_in.seated"
  | "analytics.exported";

export type WriteAuditLogInput = {
  restaurantId: string;
  userId: string;
  action: AuditAction;
  entityType:
    | "restaurant"
    | "branch"
    | "restaurant_settings"
    | "operating_hours"
    | "special_hours"
    | "restaurant_table"
    | "table_section"
    | "customer"
    | "queue"
    | "queue_entry"
    | "display"
    | "qr_code"
    | "reservation";
  entityId: string;
  metadata?: Record<string, Json | undefined>;
};

export function isSensitiveAuditKey(key: string): boolean {
  const lowered = key.toLowerCase().replace(/[_-]/g, "");
  if (lowered === "hasphone" || lowered === "hasemail") {
    return false;
  }
  return (
    lowered.includes("password") ||
    lowered.includes("token") ||
    lowered.includes("phone") ||
    lowered.includes("email")
  );
}

function sanitizeMetadata(
  metadata: Record<string, Json | undefined> | undefined,
): Record<string, Json> {
  if (!metadata) {
    return {};
  }

  const result: Record<string, Json> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (isSensitiveAuditKey(key)) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

/**
 * Best-effort audit write. Failures are swallowed so they never block
 * the primary mutation the user already completed.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      restaurant_id: input.restaurantId,
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch {
    // Intentionally ignore — audit must not break product flows.
  }
}
