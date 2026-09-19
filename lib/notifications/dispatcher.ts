import { createEmailProvider } from "@/lib/notifications/providers/email";
import { createWhatsAppProvider } from "@/lib/notifications/providers/whatsapp";
import { createSmsProvider } from "@/lib/notifications/providers/sms";
import { createInAppProvider } from "@/lib/notifications/providers/in-app";
import type {
  EmailProvider,
  InAppProvider,
  SmsProvider,
  WhatsAppProvider,
} from "@/lib/notifications/providers/types";
import type {
  NotificationChannel,
  NotificationResult,
  RenderedTemplate,
} from "@/lib/notifications/types";

export type NotificationProviders = {
  email: EmailProvider;
  whatsapp: WhatsAppProvider;
  sms: SmsProvider;
  inApp: InAppProvider;
};

export function createDefaultProviders(): NotificationProviders {
  return {
    email: createEmailProvider(),
    whatsapp: createWhatsAppProvider(),
    sms: createSmsProvider(),
    inApp: createInAppProvider(),
  };
}

export type DispatchInput = {
  channel: NotificationChannel;
  recipient: string;
  template: RenderedTemplate;
  providers?: NotificationProviders;
};

/**
 * Routes a rendered notification to the correct provider.
 * Returns a normalized result — never throws provider-specific errors upward.
 */
export async function dispatchNotification(
  input: DispatchInput,
): Promise<NotificationResult> {
  const providers = input.providers ?? createDefaultProviders();

  try {
    switch (input.channel) {
      case "EMAIL":
        return await providers.email.send({
          to: input.recipient,
          subject: input.template.subject ?? input.template.title,
          text: input.template.body,
        });
      case "WHATSAPP":
        return await providers.whatsapp.send({
          to: input.recipient,
          body: input.template.body,
        });
      case "SMS":
        return await providers.sms.send({
          to: input.recipient,
          body: input.template.body,
        });
      case "IN_APP":
        return await providers.inApp.send({
          recipient: input.recipient,
          title: input.template.title,
          body: input.template.body,
        });
      default: {
        const _exhaustive: never = input.channel;
        void _exhaustive;
        return {
          ok: false,
          provider: "none",
          retryable: false,
          errorCode: "VALIDATION",
          errorMessage: "Unsupported notification channel.",
        };
      }
    }
  } catch {
    return {
      ok: false,
      provider: "none",
      retryable: true,
      errorCode: "UNKNOWN",
      errorMessage: "Unexpected dispatcher failure.",
    };
  }
}
