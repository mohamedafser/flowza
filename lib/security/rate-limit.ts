/**
 * In-process sliding-window rate limiter.
 *
 * Counts are per Node/Edge isolate — not shared across serverless replicas.
 * Configure limits via RATE_LIMIT_* env vars. For multi-instance production,
 * prefer an edge/WAF limiter or an optional shared store; see SECURITY.md.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type WindowEntry = {
  timestamps: number[];
};

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, WindowEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = this.now();
    const cutoff = now - windowMs;
    const current = this.buckets.get(key) ?? { timestamps: [] };
    current.timestamps = current.timestamps.filter((stamp) => stamp > cutoff);

    if (current.timestamps.length >= limit) {
      const oldest = current.timestamps[0] ?? now;
      this.buckets.set(key, current);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((oldest + windowMs - now) / 1000),
        ),
      };
    }

    current.timestamps.push(now);
    this.buckets.set(key, current);
    return {
      allowed: true,
      remaining: Math.max(0, limit - current.timestamps.length),
      retryAfterSeconds: 0,
    };
  }

  reset() {
    this.buckets.clear();
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Public / QR / display endpoints */
export const PUBLIC_QUEUE_RATE_LIMITS = {
  discovery: {
    limit: envInt("RATE_LIMIT_PUBLIC_DISCOVERY", 60),
    windowMs: 60_000,
  },
  search: {
    limit: envInt("RATE_LIMIT_PUBLIC_SEARCH", 30),
    windowMs: 60_000,
  },
  join: {
    limit: envInt("RATE_LIMIT_PUBLIC_JOIN", 8),
    windowMs: 60_000,
  },
  status: {
    limit: envInt("RATE_LIMIT_PUBLIC_STATUS", 30),
    windowMs: 60_000,
  },
  cancel: {
    limit: envInt("RATE_LIMIT_PUBLIC_CANCEL", 8),
    windowMs: 60_000,
  },
  display: {
    limit: envInt("RATE_LIMIT_PUBLIC_DISPLAY", 60),
    windowMs: 60_000,
  },
  qr: {
    limit: envInt("RATE_LIMIT_PUBLIC_QR", 60),
    windowMs: 60_000,
  },
} as const;

export type PublicQueueRateLimitAction = keyof typeof PUBLIC_QUEUE_RATE_LIMITS;

/** Auth, billing, admin, webhooks */
export const APP_RATE_LIMITS = {
  authLogin: {
    limit: envInt("RATE_LIMIT_AUTH_LOGIN", 10),
    windowMs: 60_000,
  },
  authSignup: {
    limit: envInt("RATE_LIMIT_AUTH_SIGNUP", 5),
    windowMs: 60_000,
  },
  authForgotPassword: {
    limit: envInt("RATE_LIMIT_AUTH_FORGOT_PASSWORD", 5),
    windowMs: 60_000,
  },
  authVerifyOtp: {
    limit: envInt("RATE_LIMIT_AUTH_VERIFY_OTP", 10),
    windowMs: 60_000,
  },
  authResendOtp: {
    limit: envInt("RATE_LIMIT_AUTH_RESEND_OTP", 5),
    windowMs: 60_000,
  },
  authResetPassword: {
    limit: envInt("RATE_LIMIT_AUTH_RESET_PASSWORD", 5),
    windowMs: 60_000,
  },
  billingCheckout: {
    limit: envInt("RATE_LIMIT_BILLING_CHECKOUT", 10),
    windowMs: 60_000,
  },
  billingVerify: {
    limit: envInt("RATE_LIMIT_BILLING_VERIFY", 20),
    windowMs: 60_000,
  },
  billingMutate: {
    limit: envInt("RATE_LIMIT_BILLING_MUTATE", 10),
    windowMs: 60_000,
  },
  webhookRazorpay: {
    limit: envInt("RATE_LIMIT_WEBHOOK_RAZORPAY", 120),
    windowMs: 60_000,
  },
  adminApi: {
    limit: envInt("RATE_LIMIT_ADMIN_API", 120),
    windowMs: 60_000,
  },
} as const;

export type AppRateLimitAction = keyof typeof APP_RATE_LIMITS;

export type RateLimitAction =
  | PublicQueueRateLimitAction
  | AppRateLimitAction;

export const publicQueueRateLimiter = new MemoryRateLimiter();
export const appRateLimiter = new MemoryRateLimiter();

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

export function consumePublicQueueRateLimit(
  action: PublicQueueRateLimitAction,
  ip: string,
): RateLimitResult {
  const config = PUBLIC_QUEUE_RATE_LIMITS[action];
  return publicQueueRateLimiter.consume(
    `${action}:${ip}`,
    config.limit,
    config.windowMs,
  );
}

export function consumeAppRateLimit(
  action: AppRateLimitAction,
  ip: string,
  extraKey = "",
): RateLimitResult {
  const config = APP_RATE_LIMITS[action];
  const suffix = extraKey ? `:${extraKey.slice(0, 128)}` : "";
  return appRateLimiter.consume(
    `${action}:${ip}${suffix}`,
    config.limit,
    config.windowMs,
  );
}

export function resolveAppRateLimitAction(
  pathname: string,
  method: string,
): AppRateLimitAction | null {
  if (method !== "POST" && method !== "PATCH" && method !== "PUT" && method !== "DELETE") {
    if (pathname.startsWith("/api/admin/") && method === "GET") {
      return "adminApi";
    }
    return null;
  }

  switch (pathname) {
    case "/api/auth/login":
      return "authLogin";
    case "/api/auth/signup":
      return "authSignup";
    case "/api/auth/forgot-password":
      return "authForgotPassword";
    case "/api/auth/verify-otp":
      return "authVerifyOtp";
    case "/api/auth/resend-otp":
      return "authResendOtp";
    case "/api/auth/reset-password":
      return "authResetPassword";
    case "/api/billing/checkout":
      return "billingCheckout";
    case "/api/billing/verify":
      return "billingVerify";
    case "/api/billing/cancel":
    case "/api/billing/reactivate":
      return "billingMutate";
    case "/api/webhooks/razorpay":
      return "webhookRazorpay";
    default:
      break;
  }

  if (pathname.startsWith("/api/admin/")) {
    return "adminApi";
  }

  return null;
}
