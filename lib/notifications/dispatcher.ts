import { createEmailProvider } from "@/lib/notifications/providers/email";
import { createWhatsAppProvider } from "@/lib/notifications/providers/whatsapp";
import { createSmsProvider } from "@/lib/notifications/providers/sms";
import { createInAppProvider } from "@/lib/notifications/providers/in-app";
import { createWebPushProvider } from "@/lib/notifications/providers/push";
import type {
  EmailProvider,
  InAppProvider,
  SmsProvider,
  WhatsAppProvider,
} from "@/lib/notifications/providers/types";
import type { WebPushProvider } from "@/lib/notifications/providers/push";
import type {
  NotificationChannel,
  NotificationResult,
  RenderedTemplate,
} from "@/lib/notifications/types";
import { DASHBOARD_QUEUE_PATH, getAppOrigin } from "@/lib/auth/paths";

export type NotificationProviders = {
  email: EmailProvider;
  whatsapp: WhatsAppProvider;
  sms: SmsProvider;
  inApp: InAppProvider;
  push: WebPushProvider;
};

export function createDefaultProviders(): NotificationProviders {
  return {
    email: createEmailProvider(),
    whatsapp: createWhatsAppProvider(),
    sms: createSmsProvider(),
    inApp: createInAppProvider(),
    push: createWebPushProvider(),
  };
}

export type DispatchInput = {
  channel: NotificationChannel;
  recipient: string;
  template: RenderedTemplate;
  providers?: NotificationProviders;
  restaurantId?: string;
  audience?: "STAFF" | "CUSTOMER";
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
          html:
            input.template.html ??
            `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;white-space:pre-wrap;line-height:1.5;margin:0;">${input.template.body
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")}</pre>`,
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
      case "PUSH": {
        const isStaff =
          input.audience === "STAFF" ||
          input.recipient.startsWith("restaurant:");
        return await providers.push.send({
          recipient: input.recipient,
          title: input.template.title,
          body: input.template.body,
          url: isStaff
            ? `${getAppOrigin()}${DASHBOARD_QUEUE_PATH}`
            : getAppOrigin(),
          tag: input.template.subject ?? input.template.title,
          restaurantId: input.restaurantId,
          audience: isStaff ? "STAFF" : "CUSTOMER",
        });
      }
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
