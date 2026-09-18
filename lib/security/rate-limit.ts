/**
 * In-process sliding-window rate limiter for public queue endpoints.
 *
 * Limitation: counts are stored in memory on this Node.js instance only.
 * They are not shared across serverless replicas, rolling deploys, or
 * multiple app servers. Replace with Redis/Upstash (or an API gateway
 * limiter) before running many instances in production.
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

export const PUBLIC_QUEUE_RATE_LIMITS = {
  discovery: { limit: 60, windowMs: 60_000 },
  join: { limit: 8, windowMs: 60_000 },
  status: { limit: 30, windowMs: 60_000 },
  cancel: { limit: 8, windowMs: 60_000 },
  display: { limit: 60, windowMs: 60_000 },
  qr: { limit: 60, windowMs: 60_000 },
} as const;

export type PublicQueueRateLimitAction = keyof typeof PUBLIC_QUEUE_RATE_LIMITS;

export const publicQueueRateLimiter = new MemoryRateLimiter();

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
