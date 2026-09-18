import { describe, expect, it } from "vitest";
import {
  MemoryRateLimiter,
  clientIpFromHeaders,
} from "@/lib/security/rate-limit";

describe("public queue rate limiter", () => {
  it("allows requests under the limit and then blocks", () => {
    const now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    expect(limiter.consume("join:1.1.1.1", 2, 60_000).allowed).toBe(true);
    expect(limiter.consume("join:1.1.1.1", 2, 60_000).allowed).toBe(true);
    const blocked = limiter.consume("join:1.1.1.1", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates keys and expires the window", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    expect(limiter.consume("join:a", 1, 1_000).allowed).toBe(true);
    expect(limiter.consume("status:a", 1, 1_000).allowed).toBe(true);
    now = 2_100;
    expect(limiter.consume("join:a", 1, 1_000).allowed).toBe(true);
  });

  it("reads a client IP from forwarding headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.8");
  });
});
