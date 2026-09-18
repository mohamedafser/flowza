import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/permissions";
import { authorizeQueueScope } from "@/lib/utils/queue";
import {
  canConfigureQueue,
  canManageQueue,
  canViewQueue,
} from "@/lib/utils/queue";

describe("queue security helpers", () => {
  it("grants STAFF operational queue access but not configuration", () => {
    expect(hasPermission("STAFF", "queue.view")).toBe(true);
    expect(hasPermission("STAFF", "queue.manage")).toBe(true);
    expect(canViewQueue("STAFF")).toBe(true);
    expect(canManageQueue("STAFF")).toBe(true);
    expect(canConfigureQueue("STAFF")).toBe(false);
    expect(canConfigureQueue("MANAGER")).toBe(true);
  });

  it("never authorizes another restaurant's queue", () => {
    const result = authorizeQueueScope({
      membershipRestaurantId: "rest-a",
      queueRestaurantId: "rest-b",
      currentRestaurantId: "rest-a",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
    });
    expect(result).toEqual({ ok: false, reason: "restaurant" });
  });

  it("rejects a queue entry from another queue", () => {
    const result = authorizeQueueScope({
      membershipRestaurantId: "rest-a",
      queueRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
      entryQueueId: "queue-b",
      expectedQueueId: "queue-a",
    });
    expect(result).toEqual({ ok: false, reason: "queue" });
  });

  it("rejects a customer from another restaurant", () => {
    const result = authorizeQueueScope({
      membershipRestaurantId: "rest-a",
      queueRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
      customerRestaurantId: "rest-b",
    });
    expect(result).toEqual({ ok: false, reason: "customer" });
  });
});
