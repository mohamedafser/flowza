import type {
  EmailMessage,
  InAppMessage,
  NotificationResult,
  SmsMessage,
  WhatsAppMessage,
} from "@/lib/notifications/types";

export type EmailProvider = {
  readonly name: "resend" | "smtp" | "none";
  isConfigured(): boolean;
  send(input: EmailMessage): Promise<NotificationResult>;
};

export type WhatsAppProvider = {
  readonly name: "whatsapp_cloud" | "none";
  isConfigured(): boolean;
  send(input: WhatsAppMessage): Promise<NotificationResult>;
};

export type SmsProvider = {
  readonly name: "sms" | "none";
  isConfigured(): boolean;
  send(input: SmsMessage): Promise<NotificationResult>;
};

export type InAppProvider = {
  readonly name: "in_app";
  isConfigured(): boolean;
  send(input: InAppMessage): Promise<NotificationResult>;
};

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
