/**
 * Centralized email design tokens.
 * Templates must not hardcode colors — use these values only.
 */

export const EMAIL_BRAND = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Flowza",
  tagline: "Simplify the flow of your business.",
  appUrl:
    process.env.EMAIL_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3002",
  logoUrl:
    process.env.EMAIL_LOGO_URL?.trim() ||
    `${
      process.env.EMAIL_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3002"
    }/icons/icon-192x192.png`,
  supportEmail:
    process.env.EMAIL_SUPPORT_EMAIL?.trim() ||
    process.env.SMTP_SENDER_EMAIL?.trim() ||
    "support@flowza.app",
  privacyPath: "/privacy",
  termsPath: "/terms",
} as const;

export const EMAIL_COLORS = {
  background: "#F4F5F7",
  card: "#FFFFFF",
  primary: "#0F172A",
  primaryForeground: "#FFFFFF",
  text: "#1E293B",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  errorBorder: "#FECACA",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",
  otpBg: "#F8FAFC",
  otpBorder: "#CBD5E1",
  accentSoft: "#EEF2FF",
} as const;

export const EMAIL_TYPOGRAPHY = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  monoFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  headingSize: "22px",
  headingLineHeight: "1.3",
  bodySize: "15px",
  bodyLineHeight: "1.55",
  smallSize: "13px",
  tinySize: "12px",
  otpSize: "32px",
  otpLetterSpacing: "0.28em",
} as const;

export const EMAIL_SPACING = {
  page: "32px 16px",
  card: "32px 28px",
  section: "20px",
  tight: "8px",
  medium: "16px",
  loose: "24px",
} as const;

export const EMAIL_RADIUS = {
  card: "16px",
  button: "10px",
  badge: "999px",
  otp: "12px",
  inner: "10px",
} as const;

export const EMAIL_BUTTONS = {
  primaryBg: EMAIL_COLORS.primary,
  primaryText: EMAIL_COLORS.primaryForeground,
  secondaryBg: EMAIL_COLORS.borderSoft,
  secondaryText: EMAIL_COLORS.text,
  successBg: EMAIL_COLORS.success,
  successText: "#FFFFFF",
  dangerBg: EMAIL_COLORS.error,
  dangerText: "#FFFFFF",
  ghostBg: "transparent",
  ghostText: EMAIL_COLORS.primary,
  padding: "14px 22px",
  fontSize: "14px",
  fontWeight: "600",
} as const;

export const EMAIL_FOOTER = {
  copyright: (year: number) =>
    `© ${year} ${EMAIL_BRAND.name}. All rights reserved.`,
  linksLabel: "Privacy · Terms · Support",
} as const;

export type EmailStatusTone =
  | "SUCCESS"
  | "INFO"
  | "WARNING"
  | "ERROR"
  | "NEUTRAL";

export const EMAIL_STATUS_STYLES: Record<
  EmailStatusTone,
  { bg: string; border: string; color: string; icon: string; label: string }
> = {
  SUCCESS: {
    bg: EMAIL_COLORS.successBg,
    border: EMAIL_COLORS.successBorder,
    color: EMAIL_COLORS.success,
    icon: "✓",
    label: "Confirmed",
  },
  INFO: {
    bg: EMAIL_COLORS.infoBg,
    border: EMAIL_COLORS.infoBorder,
    color: EMAIL_COLORS.info,
    icon: "i",
    label: "Information",
  },
  WARNING: {
    bg: EMAIL_COLORS.warningBg,
    border: EMAIL_COLORS.warningBorder,
    color: EMAIL_COLORS.warning,
    icon: "!",
    label: "Action required",
  },
  ERROR: {
    bg: EMAIL_COLORS.errorBg,
    border: EMAIL_COLORS.errorBorder,
    color: EMAIL_COLORS.error,
    icon: "×",
    label: "Cancelled",
  },
  NEUTRAL: {
    bg: EMAIL_COLORS.borderSoft,
    border: EMAIL_COLORS.border,
    color: EMAIL_COLORS.textMuted,
    icon: "•",
    label: "Update",
  },
};
