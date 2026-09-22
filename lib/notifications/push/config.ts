/**
 * Server-only Web Push / VAPID configuration.
 * Never import private key into client components.
 */

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function getVapidPublicKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    "";
  return key || null;
}

export function getVapidConfig(): VapidConfig | null {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    (process.env.EMAIL_SUPPORT_EMAIL?.trim()
      ? `mailto:${process.env.EMAIL_SUPPORT_EMAIL.trim()}`
      : process.env.SMTP_SENDER_EMAIL?.trim()
        ? `mailto:${process.env.SMTP_SENDER_EMAIL.trim()}`
        : "mailto:support@flowza.app");

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export function isWebPushConfigured(): boolean {
  return getVapidConfig() !== null;
}
