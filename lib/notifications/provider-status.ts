import { createDefaultProviders } from "@/lib/notifications/dispatcher";

export type NotificationProviderStatus = {
  email: {
    configured: boolean;
    provider: "smtp" | "resend" | "none";
    label: string;
  };
  whatsapp: {
    configured: boolean;
    label: string;
  };
  sms: {
    configured: boolean;
    label: string;
  };
  inApp: {
    configured: boolean;
    label: string;
  };
  push: {
    configured: boolean;
    label: string;
  };
};

/** Server-only: which delivery backends are ready (never expose secrets). */
export function getNotificationProviderStatus(): NotificationProviderStatus {
  const providers = createDefaultProviders();
  const emailName = providers.email.name;
  const whatsappOk = providers.whatsapp.isConfigured();
  const smsOk = providers.sms.isConfigured();

  return {
    email: {
      configured: providers.email.isConfigured(),
      provider: emailName,
      label:
        emailName === "smtp"
          ? "SMTP configured — emails will send when Email is enabled below."
          : emailName === "resend"
            ? "Resend configured — emails will send when Email is enabled below."
            : "Not configured. Set SMTP_* (preferred) or RESEND_* in the server environment.",
    },
    whatsapp: {
      configured: whatsappOk,
      label: whatsappOk
        ? "WhatsApp Cloud API configured — messages send when WhatsApp is enabled and the guest has a phone number."
        : "Not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
    },
    sms: {
      configured: smsOk,
      label: smsOk
        ? "SMS provider configured."
        : "Not configured. Set SMS_PROVIDER_API_KEY and SMS_PROVIDER_ENDPOINT.",
    },
    inApp: {
      configured: true,
      label:
        "In-app staff alerts appear in the header bell when queue status changes (join, call, seat, cancel, no-show).",
    },
    push: {
      configured: providers.push.isConfigured(),
      label: providers.push.isConfigured()
        ? "Web Push configured — staff and guests can enable device alerts (uses the In-app setting)."
        : "Not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (generate with: npx web-push generate-vapid-keys).",
    },
  };
}
