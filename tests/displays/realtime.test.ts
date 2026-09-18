import { describe, expect, it, vi } from "vitest";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { PUBLIC_DISPLAY_FALLBACK_INTERVAL_MS } from "@/lib/public-display/paths";
import { subscribeToPublicQueue } from "@/services/realtime/queue-realtime";

describe("public display realtime behavior", () => {
  it("uses a long fallback interval rather than aggressive polling", () => {
    expect(PUBLIC_DISPLAY_FALLBACK_INTERVAL_MS).toBeGreaterThanOrEqual(30_000);
  });

  it("coalesces refreshes and cleans up timers", async () => {
    const run = vi.fn(async () => undefined);
    const controller = createCoalescedRefresh(run, 20);
    controller.request();
    controller.request();
    controller.request();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(run).toHaveBeenCalledTimes(1);
    controller.cancel();
    controller.request();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("returns a no-op cleanup when the browser client is unavailable", () => {
    const onChange = vi.fn();
    const cleanup = subscribeToPublicQueue({
      channel:
        "restaurant:11111111-1111-1111-1111-111111111111:queue:55555555-5555-5555-5555-555555555555",
      client: null,
      onChange,
    });
    expect(typeof cleanup).toBe("function");
    cleanup();
    expect(onChange).not.toHaveBeenCalled();
  });
});
