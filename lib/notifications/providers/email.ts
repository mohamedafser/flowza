import type { EmailMessage, NotificationResult } from "@/lib/notifications/types";
import {
  isValidEmailAddress,
  type EmailProvider,
} from "@/lib/notifications/providers/types";

export type { EmailProvider } from "@/lib/notifications/providers/types";

export function createEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
    "";

  return {
    name: apiKey && from ? "resend" : "none",
    isConfigured() {
      return Boolean(apiKey && from);
    },
    async send(input: EmailMessage): Promise<NotificationResult> {
      if (!apiKey || !from) {
        return {
          ok: false,
          provider: "none",
          retryable: false,
          errorCode: "NOT_CONFIGURED",
          errorMessage: "Email provider is not configured.",
        };
      }

      if (!isValidEmailAddress(input.to)) {
        return {
          ok: false,
          provider: "resend",
          retryable: false,
          errorCode: "INVALID_RECIPIENT",
          errorMessage: "Invalid email recipient.",
        };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            ...(input.html ? { html: input.html } : {}),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.status === 429) {
          return {
            ok: false,
            provider: "resend",
            retryable: true,
            errorCode: "RATE_LIMITED",
            errorMessage: "Email provider rate limited the request.",
          };
        }

        if (!response.ok) {
          const retryable = response.status >= 500;
          return {
            ok: false,
            provider: "resend",
            retryable,
            errorCode: retryable ? "PROVIDER_ERROR" : "REJECTED",
            errorMessage: "Email provider rejected the message.",
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
          provider: "resend",
          providerMessageId: id,
          retryable: false,
        };
      } catch (error) {
        const timedOut =
          error instanceof Error && error.name === "AbortError";
        return {
          ok: false,
          provider: "resend",
          retryable: true,
          errorCode: timedOut ? "TIMEOUT" : "PROVIDER_ERROR",
          errorMessage: timedOut
            ? "Email provider timed out."
            : "Email provider request failed.",
        };
      }
    },
  };
}
