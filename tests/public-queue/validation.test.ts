import { describe, expect, it } from "vitest";
import {
  joinPublicQueueFormSchema,
  joinPublicQueueSchema,
  publicAccessTokenSchema,
  publicBranchSlugParamsSchema,
} from "@/lib/validations/public-queue";

describe("public queue join validation", () => {
  const schema = joinPublicQueueSchema({ requirePhone: true });

  it("accepts a valid join payload and normalizes phone", () => {
    const parsed = schema.parse({
      name: "  Ada Lovelace ",
      phone: "+1 415 555 2671",
      partySize: 3,
    });
    expect(parsed.name).toBe("Ada Lovelace");
    expect(parsed.phone).toBe("+14155552671");
    expect(parsed.partySize).toBe(3);
  });

  it("rejects an invalid name", () => {
    expect(
      schema.safeParse({ name: " ", phone: "+14155552671", partySize: 2 })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        name: "A".repeat(121),
        phone: "+14155552671",
        partySize: 2,
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid phone", () => {
    expect(
      schema.safeParse({ name: "Ada", phone: "abc", partySize: 2 }).success,
    ).toBe(false);
    expect(
      joinPublicQueueSchema({ requirePhone: true }).safeParse({
        name: "Ada",
        phone: "",
        partySize: 2,
      }).success,
    ).toBe(false);
  });

  it("allows a blank phone when the restaurant does not require it", () => {
    const parsed = joinPublicQueueSchema({ requirePhone: false }).parse({
      name: "Ada",
      phone: "",
      partySize: 2,
    });
    expect(parsed.phone).toBeNull();
  });

  it("rejects invalid party sizes", () => {
    expect(
      schema.safeParse({ name: "Ada", phone: "+14155552671", partySize: 0 })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ name: "Ada", phone: "+14155552671", partySize: -1 })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ name: "Ada", phone: "+14155552671", partySize: 1.5 })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ name: "Ada", phone: "+14155552671", partySize: 51 })
        .success,
    ).toBe(false);
  });

  it("validates the browser form without transforming phone to null", () => {
    const form = joinPublicQueueFormSchema({ requirePhone: true });
    expect(
      form.safeParse({ name: "Ada", phone: "", partySize: 2 }).success,
    ).toBe(false);
    expect(
      form.parse({ name: "Ada", phone: "+14155552671", partySize: 2 }).phone,
    ).toBe("+14155552671");
  });
});

describe("public identifiers", () => {
  it("accepts restaurant and branch slugs", () => {
    expect(
      publicBranchSlugParamsSchema.parse({
        restaurantSlug: "demo-restaurant",
        branchSlug: "demo-branch",
      }),
    ).toEqual({
      restaurantSlug: "demo-restaurant",
      branchSlug: "demo-branch",
    });
    expect(
      publicBranchSlugParamsSchema.safeParse({
        restaurantSlug: "Bad Slug",
        branchSlug: "demo",
      }).success,
    ).toBe(false);
  });

  it("rejects short, sequential, or malformed access tokens", () => {
    expect(publicAccessTokenSchema.safeParse("A014").success).toBe(false);
    expect(
      publicAccessTokenSchema.safeParse("not-a-uuid-but-short").success,
    ).toBe(false);
    expect(
      publicAccessTokenSchema.safeParse("a".repeat(32) + "/../").success,
    ).toBe(false);
    expect(publicAccessTokenSchema.parse("a".repeat(43))).toHaveLength(43);
  });
});
