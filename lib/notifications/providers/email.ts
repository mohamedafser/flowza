import nodemailer from "nodemailer";
import { getSmtpConfig, isSmtpConfigured } from "@/lib/auth/otp/config";
import type { EmailMessage, NotificationResult } from "@/lib/notifications/types";
import {
  isValidEmailAddress,
  type EmailProvider,
} from "@/lib/notifications/providers/types";

export type { EmailProvider } from "@/lib/notifications/providers/types";

function resendConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
    "";
  return Boolean(apiKey && from);
}

async function sendViaSmtp(input: EmailMessage): Promise<NotificationResult> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return {
      ok: false,
      provider: "none",
      retryable: false,
      errorCode: "NOT_CONFIGURED",
      errorMessage: "SMTP is not configured.",
    };
  }

  if (!isValidEmailAddress(input.to)) {
    return {
      ok: false,
      provider: "smtp",
      retryable: false,
      errorCode: "INVALID_RECIPIENT",
      errorMessage: "Invalid email recipient.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    const info = await transporter.sendMail({
      from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });

    return {
      ok: true,
      provider: "smtp",
      providerMessageId:
        typeof info.messageId === "string" ? info.messageId : undefined,
      retryable: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP email send failed.";
    console.error(
      JSON.stringify({
        scope: "notifications",
        message: "smtp_send_failed",
        error: message,
      }),
    );
    return {
      ok: false,
      provider: "smtp",
      retryable: true,
      errorCode: "PROVIDER_ERROR",
      errorMessage: message,
    };
  }
}

async function sendViaResend(input: EmailMessage): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
    "";

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
    const timedOut = error instanceof Error && error.name === "AbortError";
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
}

/**
 * Queue / ops email delivery.
 * Prefers SMTP (same as auth OTP mail), then Resend.
 */
export function createEmailProvider(): EmailProvider {
  const useSmtp = isSmtpConfigured();
  const useResend = resendConfigured();

  return {
    name: useSmtp ? "smtp" : useResend ? "resend" : "none",
    isConfigured() {
      return useSmtp || useResend;
    },
    async send(input: EmailMessage): Promise<NotificationResult> {
      if (useSmtp) {
        return sendViaSmtp(input);
      }
      if (useResend) {
        return sendViaResend(input);
      }
      return {
        ok: false,
        provider: "none",
        retryable: false,
        errorCode: "NOT_CONFIGURED",
        errorMessage:
          "Email provider is not configured. Set SMTP_* or RESEND_* environment variables.",
      };
    },
  };
}
