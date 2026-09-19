import type { NotificationResult, SmsMessage } from "@/lib/notifications/types";
import {
  isValidPhoneNumber,
  type SmsProvider,
} from "@/lib/notifications/providers/types";

export type { SmsProvider } from "@/lib/notifications/providers/types";

/**
 * SMS provider abstraction. Disabled until SMS_PROVIDER_API_KEY is set.
 * Does not bind to a specific paid vendor — plug in later without queue changes.
 */
export function createSmsProvider(): SmsProvider {
  const apiKey = process.env.SMS_PROVIDER_API_KEY?.trim() || "";
  const endpoint = process.env.SMS_PROVIDER_ENDPOINT?.trim() || "";

  return {
    name: apiKey && endpoint ? "sms" : "none",
    isConfigured() {
      return Boolean(apiKey && endpoint);
    },
    async send(input: SmsMessage): Promise<NotificationResult> {
      if (!apiKey || !endpoint) {
        return {
          ok: false,
          provider: "none",
          retryable: false,
          errorCode: "NOT_CONFIGURED",
          errorMessage: "SMS provider is not configured.",
        };
      }

      if (!isValidPhoneNumber(input.to)) {
        return {
          ok: false,
          provider: "sms",
          retryable: false,
          errorCode: "INVALID_RECIPIENT",
          errorMessage: "Invalid SMS recipient.",
        };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: input.to,
            body: input.body,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.status === 429) {
          return {
            ok: false,
            provider: "sms",
            retryable: true,
            errorCode: "RATE_LIMITED",
            errorMessage: "SMS provider rate limited the request.",
          };
        }

        if (!response.ok) {
          const retryable = response.status >= 500;
          return {
            ok: false,
            provider: "sms",
            retryable,
            errorCode: retryable ? "PROVIDER_ERROR" : "REJECTED",
            errorMessage: "SMS provider rejected the message.",
          };
        }

        const json: unknown = await response.json().catch(() => null);
        const id =
          json &&
          typeof json === "object" &&
          "id" in json &&
          typeof (json as { id: unknown }).id === "string"
            ? (json as { id: string }).id
            : undefined;

        return {
          ok: true,
          provider: "sms",
          providerMessageId: id,
          retryable: false,
        };
      } catch (error) {
        const timedOut =
          error instanceof Error && error.name === "AbortError";
        return {
          ok: false,
          provider: "sms",
          retryable: true,
          errorCode: timedOut ? "TIMEOUT" : "PROVIDER_ERROR",
          errorMessage: timedOut
            ? "SMS provider timed out."
            : "SMS provider request failed.",
        };
      }
    },
  };
}
