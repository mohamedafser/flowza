import { describe, expect, it } from "vitest";
import { isProtectedPath, isPublicAuthAssetPath } from "@/lib/auth/paths";
import {
  collectObjectKeys,
  formatPublicAddress,
  toPublicQueueInfo,
  toPublicQueueJoin,
  toPublicQueueStatus,
  type PublicQueueRpcInfo,
  type PublicQueueRpcJoin,
} from "@/lib/public-queue/dto";
import { PUBLIC_QUEUE_SENSITIVE_KEYS } from "@/lib/public-queue/types";
import { isSensitiveAuditKey } from "@/services/audit";

const info: PublicQueueRpcInfo = {
  restaurant: {
    name: "Demo Restaurant",
    slug: "demo-restaurant",
    logo_url: "/logo.png",
  },
  branch: {
    name: "Demo Branch",
    slug: "demo-branch",
    address_line_1: "100 Main Street",
  },
  queue: { name: "Main Queue", status: "ACTIVE" },
  settings: {
    require_customer_phone: true,
    allow_customer_cancel: true,
  },
  timezone: "Asia/Kolkata",
  is_open: true,
  waiting_count: 1,
  serving_count: 0,
  now_serving_token: null,
  estimated_service_minutes: 15,
  availability_reason: "ok",
  peers: [
    {
      id: "private-id",
      status: "WAITING",
      joined_at: "2026-09-18T10:00:00.000Z",
      party_size: 2,
      token: "A001",
    },
  ],
};

describe("public queue security", () => {
  it("keeps public queue routes unauthenticated", () => {
    expect(isProtectedPath("/queue/demo-restaurant/demo-branch")).toBe(false);
    expect(isProtectedPath("/queue/demo-restaurant/demo-branch/join")).toBe(
      false,
    );
    expect(
      isProtectedPath("/queue/demo-restaurant/demo-branch/status/token"),
    ).toBe(false);
    expect(isPublicAuthAssetPath("/api/public/queue/token")).toBe(true);
  });

  it("omits PII, membership, and internal ids from public info", () => {
    const mapped = toPublicQueueInfo(info);
    const keys = [...collectObjectKeys(mapped)].map((key) =>
      key.toLowerCase().replace(/[_-]/g, ""),
    );
    expect(keys).not.toContain("phone");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("id");
    expect(keys).not.toContain("customerid");
    expect(keys).not.toContain("membership");
    expect(keys).not.toContain("role");
    expect(mapped.restaurant.logoUrl).toBe("/logo.png");
  });

  it("does not expose peer entry ids or access tokens in public status", () => {
    const join: PublicQueueRpcJoin = {
      ...info,
      queue: { name: "Main Queue", status: "ACTIVE" },
      access_token: "d".repeat(43),
      reused: false,
      entry: {
        id: "should-not-leak",
        token: "A001",
        status: "WAITING",
        party_size: 2,
        joined_at: "2026-09-18T10:00:00.000Z",
      },
      peers: info.peers ?? [],
    };
    const mapped = toPublicQueueJoin(join);
    const status = toPublicQueueStatus(join);
    const blob = `${JSON.stringify(mapped.status)}${JSON.stringify(status)}`;
    expect(blob).not.toContain("should-not-leak");
    expect(blob).not.toContain("private-id");
    expect(JSON.stringify(mapped.status)).not.toContain(mapped.accessToken);
  });

  it("treats access tokens as sensitive audit metadata", () => {
    expect(isSensitiveAuditKey("public_access_token")).toBe(true);
    expect(isSensitiveAuditKey("phone")).toBe(true);
    expect(isSensitiveAuditKey("email")).toBe(true);
  });

  it("formats a public address without contact fields", () => {
    expect(
      formatPublicAddress({
        address_line_1: "100 Main Street",
        city: "Demo City",
        country: "US",
      }),
    ).toBe("100 Main Street, Demo City, US");
  });

  it("lists the sensitive keys that must stay off public DTOs", () => {
    expect(PUBLIC_QUEUE_SENSITIVE_KEYS).toContain("phone");
    expect(PUBLIC_QUEUE_SENSITIVE_KEYS).toContain("email");
    expect(PUBLIC_QUEUE_SENSITIVE_KEYS).toContain("membership");
  });
});
