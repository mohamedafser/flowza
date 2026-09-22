import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireVerifiedAuth } from "@/lib/auth/guards";
import { DASHBOARD_QUEUE_PATH, getAppOrigin } from "@/lib/auth/paths";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(8).max(512),
    auth: z.string().min(8).max(512),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export async function upsertStaffPushSubscription(input: {
  restaurantId: string;
  subscription: PushSubscriptionInput;
  userAgent?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const auth = await requireVerifiedAuth();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("id")
    .eq("restaurant_id", input.restaurantId)
    .eq("user_id", auth.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "You are not a member of this restaurant." };
  }

  const clickUrl = `${getAppOrigin()}${DASHBOARD_QUEUE_PATH}`;
  const expiration =
    input.subscription.expirationTime != null
      ? new Date(input.subscription.expirationTime).toISOString()
      : null;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        restaurant_id: input.restaurantId,
        audience: "STAFF",
        user_id: auth.user.id,
        customer_id: null,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        expiration_time: expiration,
        user_agent: input.userAgent?.slice(0, 500) ?? null,
        click_url: clickUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Unable to save push subscription." };
  }

  return { ok: true, id: data.id };
}

export async function deleteStaffPushSubscription(input: {
  endpoint: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = await requireVerifiedAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", input.endpoint)
    .eq("user_id", auth.user.id)
    .eq("audience", "STAFF");

  if (error) {
    return { ok: false, message: "Unable to remove push subscription." };
  }

  return { ok: true };
}

export async function upsertCustomerPushSubscription(input: {
  accessToken: string;
  subscription: PushSubscriptionInput;
  clickUrl: string;
  userAgent?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Push subscriptions are unavailable." };
  }

  const { data: entry, error: entryError } = await admin
    .from("queue_entries")
    .select("id, customer_id, queue_id")
    .eq("public_access_token", input.accessToken)
    .maybeSingle();

  if (entryError || !entry?.customer_id || !entry.queue_id) {
    return { ok: false, message: "Queue entry not found." };
  }

  const { data: queue } = await admin
    .from("queues")
    .select("branch_id")
    .eq("id", entry.queue_id)
    .maybeSingle();

  if (!queue?.branch_id) {
    return { ok: false, message: "Queue entry not found." };
  }

  const { data: branch } = await admin
    .from("branches")
    .select("restaurant_id")
    .eq("id", queue.branch_id)
    .maybeSingle();

  const restaurantId = branch?.restaurant_id;
  if (!restaurantId) {
    return { ok: false, message: "Queue entry not found." };
  }

  const expiration =
    input.subscription.expirationTime != null
      ? new Date(input.subscription.expirationTime).toISOString()
      : null;

  const { data, error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        restaurant_id: restaurantId,
        audience: "CUSTOMER",
        user_id: null,
        customer_id: entry.customer_id,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        expiration_time: expiration,
        user_agent: input.userAgent?.slice(0, 500) ?? null,
        click_url: input.clickUrl.slice(0, 2048),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Unable to save push subscription." };
  }

  return { ok: true, id: data.id };
}

export async function deleteCustomerPushSubscription(input: {
  accessToken: string;
  endpoint: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Push subscriptions are unavailable." };
  }

  const { data: entry } = await admin
    .from("queue_entries")
    .select("customer_id")
    .eq("public_access_token", input.accessToken)
    .maybeSingle();

  if (!entry?.customer_id) {
    return { ok: false, message: "Queue entry not found." };
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", input.endpoint)
    .eq("customer_id", entry.customer_id)
    .eq("audience", "CUSTOMER");

  if (error) {
    return { ok: false, message: "Unable to remove push subscription." };
  }

  return { ok: true };
}
