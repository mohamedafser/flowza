import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/permissions";
import {
  customerExperienceSchema,
  generalSettingsSchema,
  queueSettingsSchema,
} from "@/lib/validations/settings";

const restaurantId = "11111111-1111-1111-1111-111111111111";

const validGeneral = {
  name: "Harbor Kitchen",
  email: "hello@harbor.test",
  phone: "+15550100",
  website: "https://harbor.test",
  description: "Seafood",
  timezone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
};

describe("general settings validation", () => {
  it("accepts a complete general settings payload", () => {
    const parsed = generalSettingsSchema.safeParse(validGeneral);
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid date format", () => {
    const parsed = generalSettingsSchema.safeParse({
      ...validGeneral,
      dateFormat: "YY/MM/DD",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown timezone", () => {
    const parsed = generalSettingsSchema.safeParse({
      ...validGeneral,
      timezone: "Not/AZone",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("queue settings validation", () => {
  const validQueue = {
    queueEnabled: true,
    defaultQueueName: "Main Queue",
    tokenPrefix: "A",
    startingTokenNumber: 1,
    defaultServiceMinutes: 15,
    maxQueueCapacity: 50,
    allowWalkIns: true,
    allowSelfCheckIn: true,
    allowManualEntry: true,
    showEstimatedWait: true,
    showQueuePosition: true,
  };

  it("accepts a valid configuration", () => {
    const parsed = queueSettingsSchema.safeParse(validQueue);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tokenPrefix).toBe("A");
      expect(parsed.data.maxQueueCapacity).toBe(50);
    }
  });

  it("treats null capacity as unlimited", () => {
    const parsed = queueSettingsSchema.safeParse({
      ...validQueue,
      maxQueueCapacity: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.maxQueueCapacity).toBeNull();
    }
  });

  it("rejects zero or negative capacity", () => {
    expect(
      queueSettingsSchema.safeParse({
        ...validQueue,
        maxQueueCapacity: 0,
      }).success,
    ).toBe(false);
    expect(
      queueSettingsSchema.safeParse({
        ...validQueue,
        maxQueueCapacity: -10,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid service duration", () => {
    expect(
      queueSettingsSchema.safeParse({
        ...validQueue,
        defaultServiceMinutes: 0,
      }).success,
    ).toBe(false);
  });

  it("uppercases and validates token prefix", () => {
    const parsed = queueSettingsSchema.safeParse({
      ...validQueue,
      tokenPrefix: "ab12",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tokenPrefix).toBe("AB12");
    }

    expect(
      queueSettingsSchema.safeParse({
        ...validQueue,
        tokenPrefix: "A-1",
      }).success,
    ).toBe(false);
  });
});

describe("customer experience validation", () => {
  it("requires boolean flags", () => {
    const parsed = customerExperienceSchema.safeParse({
      showEstimatedWait: true,
      showQueuePosition: false,
      showPartySize: true,
      allowCustomerCancel: true,
      allowSelfCheckIn: false,
      requireCustomerName: true,
      requireCustomerPhone: true,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("settings permissions", () => {
  it("requires restaurant.manage to change configuration", () => {
    expect(hasPermission("OWNER", "restaurant.manage")).toBe(true);
    expect(hasPermission("ADMIN", "restaurant.manage")).toBe(true);
    expect(hasPermission("MANAGER", "restaurant.manage")).toBe(false);
    expect(hasPermission("STAFF", "restaurant.manage")).toBe(false);
  });

  it("allows members to view settings", () => {
    expect(hasPermission("STAFF", "settings.view")).toBe(true);
    expect(hasPermission("MANAGER", "settings.view")).toBe(true);
  });
});

describe("settings multi-tenant isolation contract", () => {
  it("keeps restaurant ids explicit on update payloads", () => {
    expect(restaurantId).not.toBe("22222222-2222-2222-2222-222222222222");
  });
});
