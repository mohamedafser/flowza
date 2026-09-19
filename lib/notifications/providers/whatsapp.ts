import type {
  NotificationResult,
  WhatsAppMessage,
} from "@/lib/notifications/types";
import {
  isValidPhoneNumber,
  type WhatsAppProvider,
} from "@/lib/notifications/providers/types";

export type { WhatsAppProvider } from "@/lib/notifications/providers/types";

/**
 * WhatsApp Cloud API provider abstraction.
 * Credentials must remain server-side only (never NEXT_PUBLIC_*).
 */
export function createWhatsAppProvider(): WhatsAppProvider {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  // Reserved for future template management — do not expose to clients.
  void process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  return {
    name: accessToken && phoneNumberId ? "whatsapp_cloud" : "none",
    isConfigured() {
      return Boolean(accessToken && phoneNumberId);
    },
    async send(input: WhatsAppMessage): Promise<NotificationResult> {
      if (!accessToken || !phoneNumberId) {
        return {
          ok: false,
          provider: "none",
          retryable: false,
          errorCode: "NOT_CONFIGURED",
          errorMessage: "WhatsApp provider is not configured.",
        };
      }

      if (!isValidPhoneNumber(input.to)) {
        return {
          ok: false,
          provider: "whatsapp_cloud",
          retryable: false,
          errorCode: "INVALID_RECIPIENT",
          errorMessage: "Invalid WhatsApp recipient.",
        };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: input.to.replace(/\D/g, ""),
              type: "text",
              text: { body: input.body, preview_url: false },
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);

        if (response.status === 429) {
          return {
            ok: false,
            provider: "whatsapp_cloud",
            retryable: true,
            errorCode: "RATE_LIMITED",
            errorMessage: "WhatsApp provider rate limited the request.",
          };
        }

        if (!response.ok) {
          const retryable = response.status >= 500;
          return {
            ok: false,
            provider: "whatsapp_cloud",
            retryable,
            errorCode: retryable ? "PROVIDER_ERROR" : "REJECTED",
            errorMessage: "WhatsApp provider rejected the message.",
          };
        }

        const json: unknown = await response.json().catch(() => null);
        let messageId: string | undefined;
        if (
          json &&
          typeof json === "object" &&
          "messages" in json &&
          Array.isArray((json as { messages: unknown }).messages)
        ) {
          const first = (json as { messages: Array<{ id?: unknown }> })
            .messages[0];
          if (first && typeof first.id === "string") {
            messageId = first.id;
          }
        }

        return {
          ok: true,
          provider: "whatsapp_cloud",
          providerMessageId: messageId,
          retryable: false,
        };
      } catch (error) {
        const timedOut =
          error instanceof Error && error.name === "AbortError";
        return {
          ok: false,
          provider: "whatsapp_cloud",
          retryable: true,
          errorCode: timedOut ? "TIMEOUT" : "PROVIDER_ERROR",
          errorMessage: timedOut
            ? "WhatsApp provider timed out."
            : "WhatsApp provider request failed.",
        };
      }
    },
  };
}
