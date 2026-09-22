import type {
  NotificationResult,
  WhatsAppMessage,
} from "@/lib/notifications/types";
import {
  isValidPhoneNumber,
  type WhatsAppProvider,
} from "@/lib/notifications/providers/types";

export type { WhatsAppProvider } from "@/lib/notifications/providers/types";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function extractMetaError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const error = (json as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const err = error as {
    message?: unknown;
    error_user_msg?: unknown;
    code?: unknown;
    error_subcode?: unknown;
  };
  const parts: string[] = [];
  if (typeof err.code === "number") parts.push(`code ${err.code}`);
  if (typeof err.error_user_msg === "string" && err.error_user_msg.trim()) {
    parts.push(err.error_user_msg.trim());
  } else if (typeof err.message === "string" && err.message.trim()) {
    parts.push(err.message.trim());
  }
  if (typeof err.error_subcode === "number") {
    parts.push(`subcode ${err.error_subcode}`);
  }
  return parts.length > 0 ? parts.join(" — ") : null;
}

function buildTemplateBodyParameters(
  body: string,
): Array<{ type: "text"; text: string }> {
  const rawCount = process.env.WHATSAPP_TEMPLATE_BODY_PARAM_COUNT?.trim();
  const includeLegacy =
    process.env.WHATSAPP_TEMPLATE_BODY_PARAM?.trim().toLowerCase() === "true" ||
    process.env.WHATSAPP_TEMPLATE_BODY_PARAM?.trim() === "1";

  let count = Number.parseInt(rawCount || "", 10);
  if (!Number.isFinite(count) || count < 0) {
    count = includeLegacy ? 1 : 0;
  }
  if (count === 0) return [];

  // Preferred: explicit params separated by "|||" from channel templates.
  const delimited = body
    .split("|||")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (delimited.length > 0) {
    const params = [...delimited];
    while (params.length < count) {
      params.push(params[params.length - 1] ?? "Update");
    }
    return params.slice(0, count).map((text) => ({
      type: "text" as const,
      text: text.slice(0, 200) || "Update",
    }));
  }

  const cleaned = body.replace(/\s+/g, " ").trim().slice(0, 1024) || "Update";
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const params: string[] = [];
  for (let i = 0; i < count; i += 1) {
    if (i < sentences.length) {
      params.push(sentences[i]!.slice(0, 200));
      continue;
    }
    if (i === 0) {
      params.push(cleaned.slice(0, 200));
      continue;
    }
    params.push(cleaned.slice(0, 200));
  }

  if (count >= 3 && sentences.length < 3) {
    const mid = Math.ceil(cleaned.length / 3);
    params[0] = cleaned.slice(0, mid).trim() || "Update";
    params[1] = cleaned.slice(mid, mid * 2).trim() || params[0]!;
    params[2] = cleaned.slice(mid * 2).trim() || params[1]!;
    while (params.length < count) {
      params.push(params[params.length - 1]!);
    }
  }

  return params
    .slice(0, count)
    .map((text) => ({ type: "text" as const, text }));
}

function buildPayload(input: WhatsAppMessage, to: string) {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "";
  const templateLanguage =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US";

  // Approved templates are required for business-initiated messages outside
  // Meta's 24-hour customer-care window (and for Meta test numbers).
  if (templateName) {
    const parameters = buildTemplateBodyParameters(input.body);
    const template: {
      name: string;
      language: { code: string };
      components?: Array<{
        type: string;
        parameters: Array<{ type: string; text: string }>;
      }>;
    } = {
      name: templateName,
      language: { code: templateLanguage },
    };

    if (parameters.length > 0) {
      template.components = [{ type: "body", parameters }];
    }

    return {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template,
    };
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      // Channel templates may use "|||" for Meta template params; flatten for free text.
      body: input.body
        .split("|||")
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n\n"),
      preview_url: false,
    },
  };
}

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

      const to = digitsOnly(input.to);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(
          `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(buildPayload(input, to)),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);

        const json: unknown = await response.json().catch(() => null);
        const metaError = extractMetaError(json);

        if (response.status === 429) {
          return {
            ok: false,
            provider: "whatsapp_cloud",
            retryable: true,
            errorCode: "RATE_LIMITED",
            errorMessage:
              metaError ?? "WhatsApp provider rate limited the request.",
          };
        }

        if (!response.ok) {
          const retryable = response.status >= 500;
          return {
            ok: false,
            provider: "whatsapp_cloud",
            retryable,
            errorCode: retryable ? "PROVIDER_ERROR" : "REJECTED",
            errorMessage:
              metaError ??
              `WhatsApp provider rejected the message (HTTP ${response.status}).`,
          };
        }

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
        const timedOut = error instanceof Error && error.name === "AbortError";
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
