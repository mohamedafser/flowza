import { describe, expect, it } from "vitest";
import {
  createQueueSchema,
  partySizeSchema,
  queueFieldsSchema,
} from "@/lib/validations/queue";
import { tokenPrefixSchema as settingsPrefixSchema } from "@/lib/validations/settings";

describe("queue validation", () => {
  it("requires a name, prefix, starting number, and duration", () => {
    const parsed = queueFieldsSchema.parse({
      name: "VIP Queue",
      prefix: "vip",
      startingNumber: 1,
      estimatedServiceMinutes: 20,
      status: "ACTIVE",
    });
    expect(parsed.prefix).toBe("VIP");
    expect(createQueueSchema.safeParse({ ...parsed }).success).toBe(false);
  });

  it("rejects blank names and non-positive numbers", () => {
    expect(
      queueFieldsSchema.safeParse({
        name: " ",
        prefix: "A",
        startingNumber: 1,
        estimatedServiceMinutes: 15,
        status: "ACTIVE",
      }).success,
    ).toBe(false);
    expect(partySizeSchema.safeParse(-1).success).toBe(false);
    expect(partySizeSchema.safeParse(1.5).success).toBe(false);
  });

  it("shares token prefix rules with restaurant settings", () => {
    expect(settingsPrefixSchema.parse("ab12")).toBe("AB12");
    expect(settingsPrefixSchema.safeParse("A-1").success).toBe(false);
  });
});
