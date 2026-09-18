import { describe, expect, it } from "vitest";
import {
  createQRCodeSchema,
  normalizeQRCodeSettings,
  publicQRTokenParamSchema,
  setQRCodeStatusSchema,
  updateQRCodeSchema,
} from "@/lib/validations/qr-code";
import { hasPermission } from "@/lib/auth/permissions";

describe("QR code validation", () => {
  it("accepts a valid create payload", () => {
    const parsed = createQRCodeSchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      branchId: "22222222-2222-2222-2222-222222222222",
      queueId: "55555555-5555-5555-5555-555555555555",
      name: "Main Entrance",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isActive).toBe(true);
      expect(parsed.data.name).toBe("Main Entrance");
    }
  });

  it("rejects empty names", () => {
    expect(
      createQRCodeSchema.safeParse({
        restaurantId: "11111111-1111-1111-1111-111111111111",
        branchId: "22222222-2222-2222-2222-222222222222",
        queueId: "55555555-5555-5555-5555-555555555555",
        name: "  ",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid branch and queue ids", () => {
    expect(
      createQRCodeSchema.safeParse({
        restaurantId: "11111111-1111-1111-1111-111111111111",
        branchId: "not-a-uuid",
        queueId: "55555555-5555-5555-5555-555555555555",
        name: "Front Door",
      }).success,
    ).toBe(false);
    expect(
      updateQRCodeSchema.safeParse({
        qrCodeId: "66666666-6666-6666-6666-666666666666",
        queueId: "bad",
      }).success,
    ).toBe(false);
  });

  it("validates activate/deactivate payloads", () => {
    expect(
      setQRCodeStatusSchema.safeParse({
        qrCodeId: "66666666-6666-6666-6666-666666666666",
        isActive: false,
      }).success,
    ).toBe(true);
  });

  it("validates public token params", () => {
    expect(
      publicQRTokenParamSchema.safeParse({ publicToken: "a".repeat(43) })
        .success,
    ).toBe(true);
    expect(
      publicQRTokenParamSchema.safeParse({ publicToken: "short" }).success,
    ).toBe(false);
  });

  it("normalizes QR settings with safe defaults", () => {
    expect(normalizeQRCodeSettings({})).toEqual({
      showRestaurantName: true,
      showBranchName: true,
      showQueueName: true,
    });
  });
});

describe("QR code permissions", () => {
  it("grants manage to manager+ and view to staff", () => {
    expect(hasPermission("OWNER", "qr_codes.manage")).toBe(true);
    expect(hasPermission("ADMIN", "qr_codes.manage")).toBe(true);
    expect(hasPermission("MANAGER", "qr_codes.manage")).toBe(true);
    expect(hasPermission("STAFF", "qr_codes.manage")).toBe(false);
    expect(hasPermission("STAFF", "qr_codes.view")).toBe(true);
  });
});
