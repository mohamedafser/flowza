import webpush from "web-push";
import { getVapidConfig, isWebPushConfigured } from "@/lib/notifications/push/config";
import type { PushMessage, WebPushPayload } from "@/lib/notifications/push/types";
import type { NotificationResult } from "@/lib/notifications/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth/paths";

export type WebPushProvider = {
  readonly name: "web_push" | "none";
  isConfigured(): boolean;
  send(input: PushMessage): Promise<NotificationResult>;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  click_url: string | null;
};

function parseStaffRestaurantId(recipient: string): string | null {
  const match = /^restaurant:([0-9a-f-]{36})$/i.exec(recipient.trim());
  return match?.[1] ?? null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

async function loadSubscriptions(
  input: PushMessage,
): Promise<SubscriptionRow[]> {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());

  const restaurantId =
    input.restaurantId ??
    parseStaffRestaurantId(input.recipient) ??
    null;

  if (input.audience === "STAFF" || parseStaffRestaurantId(input.recipient)) {
    if (!restaurantId) return [];
    const { data } = await client
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, click_url")
      .eq("audience", "STAFF")
      .eq("restaurant_id", restaurantId);
    return (data ?? []) as SubscriptionRow[];
  }

  // Customer recipient is the customer uuid.
  if (!isUuid(input.recipient)) return [];
  const { data } = await client
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, click_url")
    .eq("audience", "CUSTOMER")
    .eq("customer_id", input.recipient);
  return (data ?? []) as SubscriptionRow[];
}

async function deleteGoneSubscription(id: string): Promise<void> {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createClient());
  await client.from("push_subscriptions").delete().eq("id", id);
}

/**
 * Web Push delivery via VAPID + stored browser subscriptions.
 */
export function createWebPushProvider(): WebPushProvider {
  const configured = isWebPushConfigured();

  return {
    name: configured ? "web_push" : "none",
    isConfigured() {
      return configured;
    },
    async send(input: PushMessage): Promise<NotificationResult> {
      const vapid = getVapidConfig();
      if (!vapid) {
        return {
          ok: false,
          provider: "none",
          retryable: false,
          errorCode: "NOT_CONFIGURED",
          errorMessage:
            "Web Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
        };
      }

      if (!input.title.trim() || !input.recipient.trim()) {
        return {
          ok: false,
          provider: "web_push",
          retryable: false,
          errorCode: "VALIDATION",
          errorMessage: "Invalid push notification payload.",
        };
      }

      const subscriptions = await loadSubscriptions(input);
      if (subscriptions.length === 0) {
        // No device opted in — not a hard failure for the event pipeline.
        return {
          ok: true,
          provider: "web_push",
          retryable: false,
          providerMessageId: "no_subscribers",
        };
      }

      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

      const defaultUrl = input.url?.trim() || getAppOrigin();
      const goneIds: string[] = [];

      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const payload: WebPushPayload = {
            title: input.title,
            body: input.body,
            url: sub.click_url?.trim() || defaultUrl,
            tag: input.tag,
            restaurantId: input.restaurantId,
            audience: input.audience,
          };

          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              JSON.stringify(payload),
              {
                TTL: 60 * 60,
                urgency: "high",
              },
            );
            return { ok: true as const };
          } catch (error) {
            const statusCode =
              error &&
              typeof error === "object" &&
              "statusCode" in error &&
              typeof (error as { statusCode: unknown }).statusCode === "number"
                ? (error as { statusCode: number }).statusCode
                : null;

            if (statusCode === 404 || statusCode === 410) {
              goneIds.push(sub.id);
              return { ok: false as const, gone: true };
            }

            return {
              ok: false as const,
              gone: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Web Push send failed.",
            };
          }
        }),
      );

      if (goneIds.length > 0) {
        await Promise.all(goneIds.map((id) => deleteGoneSubscription(id)));
      }

      let sent = 0;
      let lastError: string | undefined;
      for (const result of results) {
        if (result.status !== "fulfilled") {
          lastError = "Web Push send failed.";
          continue;
        }
        if (result.value.ok) {
          sent += 1;
        } else if (!result.value.gone && "error" in result.value) {
          lastError = result.value.error;
        }
      }

      if (sent === 0) {
        return {
          ok: false,
          provider: "web_push",
          retryable: true,
          errorCode: "PROVIDER_ERROR",
          errorMessage: lastError ?? "No push notifications were delivered.",
        };
      }

      return {
        ok: true,
        provider: "web_push",
        providerMessageId: `sent:${sent}`,
        retryable: false,
      };
    },
  };
}
