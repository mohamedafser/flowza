import { describe, expect, it } from "vitest";
import {
  createDisplaySchema,
  normalizeDisplaySettings,
  setDisplayStatusSchema,
  updateDisplaySchema,
} from "@/lib/validations/display";
import { hasPermission } from "@/lib/auth/permissions";
import { currentlyServingEntries, sortWaitingEntries } from "@/lib/utils/queue";

describe("display validation", () => {
  it("requires name, branch, and queue on create", () => {
    const parsed = createDisplaySchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      branchId: "22222222-2222-2222-2222-222222222222",
      queueId: "55555555-5555-5555-5555-555555555555",
      name: "Main Dining TV",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isActive).toBe(true);
      expect(parsed.data.name).toBe("Main Dining TV");
    }
  });

  it("rejects empty display names", () => {
    const parsed = createDisplaySchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      branchId: "22222222-2222-2222-2222-222222222222",
      queueId: "55555555-5555-5555-5555-555555555555",
      name: "  ",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid branch and queue ids", () => {
    expect(
      createDisplaySchema.safeParse({
        restaurantId: "11111111-1111-1111-1111-111111111111",
        branchId: "not-a-uuid",
        queueId: "55555555-5555-5555-5555-555555555555",
        name: "Lobby",
      }).success,
    ).toBe(false);
    expect(
      updateDisplaySchema.safeParse({
        displayId: "66666666-6666-6666-6666-666666666666",
        queueId: "bad",
      }).success,
    ).toBe(false);
  });

  it("validates activate/deactivate payloads", () => {
    expect(
      setDisplayStatusSchema.safeParse({
        displayId: "66666666-6666-6666-6666-666666666666",
        isActive: false,
      }).success,
    ).toBe(true);
  });

  it("normalizes display settings with safe defaults", () => {
    expect(normalizeDisplaySettings({})).toEqual({
      nextTokenCount: 3,
      showRestaurantLogo: true,
      showBranchName: true,
      showQueueName: true,
      theme: "dark",
      preferFullscreen: false,
    });
    expect(
      normalizeDisplaySettings({
        nextTokenCount: 99,
        theme: "neon",
      }).nextTokenCount,
    ).toBe(3);
    expect(
      normalizeDisplaySettings({
        nextTokenCount: 5,
        theme: "light",
      }),
    ).toMatchObject({ nextTokenCount: 5, theme: "light" });
  });
});

describe("display permissions", () => {
  it("allows managers to manage displays and staff to view only", () => {
    expect(hasPermission("MANAGER", "displays.manage")).toBe(true);
    expect(hasPermission("MANAGER", "displays.view")).toBe(true);
    expect(hasPermission("STAFF", "displays.view")).toBe(true);
    expect(hasPermission("STAFF", "displays.manage")).toBe(false);
  });
});

describe("display queue token selection", () => {
  const entries = [
    {
      id: "1",
      status: "WAITING" as const,
      token: "A015",
      joined_at: "2026-09-18T10:01:00.000Z",
      called_at: null,
    },
    {
      id: "2",
      status: "CALLED" as const,
      token: "A014",
      joined_at: "2026-09-18T10:00:00.000Z",
      called_at: "2026-09-18T10:05:00.000Z",
    },
    {
      id: "3",
      status: "WAITING" as const,
      token: "A016",
      joined_at: "2026-09-18T10:02:00.000Z",
      called_at: null,
    },
    {
      id: "4",
      status: "SEATED" as const,
      token: "A013",
      joined_at: "2026-09-18T09:50:00.000Z",
      called_at: "2026-09-18T09:55:00.000Z",
    },
    {
      id: "5",
      status: "CANCELLED" as const,
      token: "A012",
      joined_at: "2026-09-18T09:40:00.000Z",
      called_at: null,
    },
  ];

  it("orders next tokens with Phase 8 waiting order and excludes terminal statuses", () => {
    const next = sortWaitingEntries(entries).map((entry) => entry.token);
    expect(next).toEqual(["A015", "A016"]);
  });

  it("prefers called entries for now serving and ignores seated as display next", () => {
    const serving = currentlyServingEntries(
      entries.map((entry) => ({
        ...entry,
        queue_id: "q",
        customer_id: null,
        table_id: null,
        business_date: "2026-09-18",
        party_size: 2,
        seated_at: null,
        completed_at: null,
        cancelled_at: null,
        skipped_at: null,
        no_show_at: null,
        created_at: entry.joined_at,
        updated_at: entry.joined_at,
      })),
    );
    expect(serving[0]?.token).toBe("A014");
    expect(serving.some((entry) => entry.status === "WAITING")).toBe(false);
  });
});
