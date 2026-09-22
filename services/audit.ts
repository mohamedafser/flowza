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
  | "organization.created"
  | "organization.updated"
  | "member.added"
  | "member.invited"
  | "member.invite_revoked"
  | "member.role_updated"
  | "member.removed"
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
  | "analytics.exported"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.upgraded"
  | "subscription.downgraded"
  | "subscription.cancelled"
  | "subscription.reactivated"
  | "payment.succeeded"
  | "payment.failed"
  | "RESTAURANT_SUSPENDED"
  | "RESTAURANT_REACTIVATED"
  | "USER_DISABLED"
  | "USER_REENABLED"
  | "PLAN_CREATED"
  | "PLAN_UPDATED"
  | "PLAN_ACTIVATED"
  | "PLAN_DEACTIVATED"
  | "SUBSCRIPTION_UPDATED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_REACTIVATED"
  | "TRIAL_EXTENDED"
  | "PLATFORM_SETTINGS_UPDATED"
  | "LOGIN_FAILURE"
  | "CUSTOMER_MERGED"
  | "ADMIN_ACTION";

export type WriteAuditLogInput = {
  restaurantId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
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
    | "reservation"
    | "organization"
    | "member"
    | "invitation"
    | "subscription"
    | "payment"
    | "plan"
    | "user"
    | "platform_settings";
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
    lowered.includes("secret") ||
    lowered.includes("cvv") ||
    lowered.includes("cardnumber") ||
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
      restaurant_id: input.restaurantId ?? null,
      organization_id: input.organizationId ?? input.restaurantId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch {
    // Intentionally ignore — audit must not break product flows.
  }
}

/**
 * Platform-admin audit write via service role (cross-tenant / null restaurant).
 */
export async function writePlatformAuditLog(
  input: WriteAuditLogInput,
): Promise<void> {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/admin");
    const admin = createServiceRoleClient();
    if (!admin) {
      await writeAuditLog(input);
      return;
    }

    await admin.from("audit_logs").insert({
      restaurant_id: input.restaurantId ?? null,
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: sanitizeMetadata(input.metadata),
    });
  } catch {
    // Intentionally ignore — audit must not break product flows.
  }
}
