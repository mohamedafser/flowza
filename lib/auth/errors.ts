/**
 * Map Supabase Auth / network errors to safe, user-facing messages.
 * Never surface raw internals, tokens, or SQL details.
 */

const MESSAGE_MAP: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials|invalid credentials/i,
    message: "Invalid email or password.",
  },
  {
    match: /email not confirmed/i,
    message: "Please verify your email before signing in.",
  },
  {
    match: /user already registered|already been registered|already exists/i,
    message: "An account with this email already exists.",
  },
  {
    match: /password should be at least|password.*too short|weak password/i,
    message: "Password does not meet the minimum strength requirements.",
  },
  {
    match: /unable to validate email|invalid email/i,
    message: "Please enter a valid email address.",
  },
  {
    match: /email rate limit|over_email_send_rate_limit|for security purposes/i,
    message: "Too many emails sent. Please wait a moment and try again.",
  },
  {
    match: /otp_expired|token has expired|link.*expired|expired/i,
    message: "This link has expired. Please request a new one.",
  },
  {
    match: /otp_disabled|invalid.*(otp|token|link)|flow_state/i,
    message: "This link is invalid or has already been used.",
  },
  {
    match: /same_password/i,
    message: "New password must be different from your current password.",
  },
  {
    match: /network|fetch failed|failed to fetch/i,
    message: "Network error. Check your connection and try again.",
  },
  {
    match: /session.*missing|not authenticated|auth session missing/i,
    message: "Your session has expired. Please sign in again.",
  },
];

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  if (!raw) {
    return fallback;
  }

  for (const entry of MESSAGE_MAP) {
    if (entry.match.test(raw)) {
      return entry.message;
    }
  }

  return fallback;
}
