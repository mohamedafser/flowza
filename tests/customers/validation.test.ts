import { describe, expect, it } from "vitest";
import {
  createCustomerSchema,
  customerFieldsSchema,
  customerNameSchema,
  toCustomerWritePayload,
  updateCustomerSchema,
} from "@/lib/validations/customer";

const customerId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("customer validation", () => {
  it("requires a trimmed name with a reasonable maximum", () => {
    expect(customerNameSchema.safeParse("").success).toBe(false);
    expect(customerNameSchema.safeParse("   ").success).toBe(false);
    expect(customerNameSchema.safeParse("Jo").success).toBe(true);
    expect(customerNameSchema.safeParse("A".repeat(121)).success).toBe(false);
    expect(customerNameSchema.parse("  Maya  ")).toBe("Maya");
  });

  it("accepts a name-only create payload", () => {
    const parsed = createCustomerSchema.safeParse({
      name: "Alex Rivera",
      phone: "",
      email: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBeNull();
      expect(parsed.data.email).toBeNull();
    }
  });

  it("normalizes optional phone and email", () => {
    const parsed = createCustomerSchema.safeParse({
      name: "Sam Lee",
      phone: "+1 (555) 010-2030",
      email: "  Sam.Lee@Example.COM ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("+15550102030");
      expect(parsed.data.email).toBe("sam.lee@example.com");
    }
  });

  it("rejects an invalid email", () => {
    expect(
      createCustomerSchema.safeParse({
        name: "Sam",
        phone: "",
        email: "not-an-email",
      }).success,
    ).toBe(false);
    expect(
      customerFieldsSchema.safeParse({
        name: "Sam",
        phone: "",
        email: "nope",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid phone and does not treat junk as empty", () => {
    expect(
      createCustomerSchema.safeParse({
        name: "Sam",
        phone: "abc",
        email: "",
      }).success,
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({
        name: "Sam",
        phone: "123",
        email: "",
      }).success,
    ).toBe(false);
  });

  it("does not accept a restaurant id on create or update", () => {
    const created = createCustomerSchema.safeParse({
      name: "Sam",
      phone: "",
      email: "",
      restaurantId: "11111111-1111-1111-1111-111111111111",
    });
    expect(created.success).toBe(true);
    if (created.success) {
      expect("restaurantId" in created.data).toBe(false);
    }

    const updated = updateCustomerSchema.safeParse({
      customerId,
      name: "Sam",
      phone: "",
      email: "",
      restaurantId: "11111111-1111-1111-1111-111111111111",
    });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect("restaurantId" in updated.data).toBe(false);
    }
  });

  it("rejects an invalid customer id on update", () => {
    expect(
      updateCustomerSchema.safeParse({
        customerId: "not-a-uuid",
        name: "Sam",
        phone: "",
        email: "",
      }).success,
    ).toBe(false);
  });

  it("maps form values into a normalized write payload", () => {
    const payload = toCustomerWritePayload({
      name: "  Jordan  ",
      phone: "+44 20 7946 0958",
      email: "Jordan@Example.com",
    });
    expect(payload).toEqual({
      name: "Jordan",
      phone: "+442079460958",
      email: "jordan@example.com",
    });
  });
});
