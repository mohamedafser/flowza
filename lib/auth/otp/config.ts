/**
 * Server-only OTP / SMTP configuration.
 * Never import this into client components.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getOtpConfig() {
  return {
    expiryMinutes: intEnv("OTP_EXPIRY_MINUTES", 5),
    resendCooldownSeconds: intEnv("OTP_RESEND_COOLDOWN_SECONDS", 60),
    maxAttempts: intEnv("OTP_MAX_ATTEMPTS", 5),
  };
}

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  senderName: string;
  senderEmail: string;
  secure: boolean;
};

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || "";
  const password = process.env.SMTP_PASSWORD?.trim() || "";
  const senderEmail = process.env.SMTP_SENDER_EMAIL?.trim() || "";
  const senderName =
    process.env.SMTP_SENDER_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "Flowza";
  const port = intEnv("SMTP_PORT", 587);

  if (!host || !user || !password || !senderEmail) {
    return null;
  }

  return {
    host,
    port,
    user,
    password,
    senderName,
    senderEmail,
    secure: port === 465,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

/** Prefer SMTP; fall back to existing Resend notification credentials. */
export function isAuthEmailConfigured(): boolean {
  if (isSmtpConfigured()) return true;
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
    (process.env.RESEND_FROM_EMAIL?.trim() ||
      process.env.NOTIFICATION_FROM_EMAIL?.trim()),
  );
}
