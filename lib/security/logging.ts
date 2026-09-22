/**
 * Structured security event logging for monitoring hooks.
 * Never log passwords, tokens, secrets, CVV, or full customer PII.
 */

export type SecurityEventName =
  | "LOGIN_FAILURE"
  | "LOGIN_SUCCESS"
  | "UNAUTHORIZED_ACCESS"
  | "FORBIDDEN_ACCESS"
  | "RATE_LIMIT_VIOLATION"
  | "WEBHOOK_SIGNATURE_FAILURE"
  | "WEBHOOK_PROCESSED"
  | "CROSS_TENANT_ATTEMPT"
  | "ROLE_ESCALATION_BLOCKED"
  | "ADMIN_ACTION"
  | "PAYMENT_FAILURE"
  | "SUSPICIOUS_REQUEST";

const SENSITIVE_KEY =
  /password|secret|token|authorization|cookie|cvv|card|api[_-]?key|service[_-]?role|phone|email|otp|refresh/i;

function sanitizeValue(key: string, value: unknown): unknown {
  // Allow explicitly masked fields through (emailMasked, phoneMasked).
  if (/masked$/i.test(key) || key === "hasPhone" || key === "hasEmail") {
    if (typeof value === "string" && value.length > 128) {
      return `${value.slice(0, 128)}…`;
    }
    return value;
  }

  if (SENSITIVE_KEY.test(key)) {
    if (typeof value === "string" && value.length > 0) {
      return "[redacted]";
    }
    return undefined;
  }
  if (typeof value === "string") {
    return value.length > 256 ? `${value.slice(0, 256)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item, index) =>
      sanitizeValue(String(index), item),
    );
  }
  if (value && typeof value === "object") {
    return sanitizeDetails(value as Record<string, unknown>);
  }
  return undefined;
}

export function sanitizeDetails(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!details) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    const sanitized = sanitizeValue(key, value);
    if (sanitized !== undefined) {
      out[key] = sanitized;
    }
  }
  return out;
}

/** Mask local part of an email for logs (a***@example.com). */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "[redacted]";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** Mask phone keeping country-ish prefix + last 2 digits. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "[redacted]";
  return `***${digits.slice(-2)}`;
}

export function logSecurityEvent(
  event: SecurityEventName,
  details: Record<string, unknown> = {},
): void {
  const payload = {
    level: "security",
    event,
    ts: new Date().toISOString(),
    ...sanitizeDetails(details),
  };

  // Structured single-line JSON for log drains / future alerting.
  console.info(JSON.stringify(payload));
}
