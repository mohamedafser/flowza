import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/auth/permissions";
import {
  authorizeCustomerScope,
  findDuplicateCustomer,
} from "@/lib/utils/customers";
import { matchIncomingDuplicate as serviceMatchIncomingDuplicate } from "@/services/customers";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/lib/validations/customer";
import type { CustomerRecord } from "@/lib/utils/customers";

const restaurantA = "11111111-1111-1111-1111-111111111111";
const restaurantB = "22222222-2222-2222-2222-222222222222";
const customerA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function record(
  partial: Partial<CustomerRecord> & { id: string },
): CustomerRecord {
  return {
    restaurant_id: restaurantA,
    name: "Ada",
    phone: "+14155552671",
    email: "ada@example.com",
    created_at: "2026-09-18T10:00:00.000Z",
    updated_at: "2026-09-18T10:00:00.000Z",
    ...partial,
  };
}

describe("customer create and update operations", () => {
  it("creates a normalized payload without a client restaurant id", () => {
    const parsed = createCustomerSchema.parse({
      name: "  Ada Lovelace ",
      phone: "+1 415 555 2671",
      email: "Ada@Example.com",
      restaurantId: restaurantB,
    });
    expect(parsed).toEqual({
      name: "Ada Lovelace",
      phone: "+14155552671",
      email: "ada@example.com",
    });
  });

  it("updates by customer id and still ignores a posted restaurant id", () => {
    const parsed = updateCustomerSchema.parse({
      customerId: customerA,
      name: "Ada",
      phone: "+14155552671",
      email: "ada@example.com",
      restaurantId: restaurantB,
    });
    expect(parsed.customerId).toBe(customerA);
    expect(parsed.phone).toBe("+14155552671");
    expect("restaurantId" in parsed).toBe(false);
  });

  it("reads a stored record as restaurant-scoped", () => {
    const stored = record({ id: customerA, restaurant_id: restaurantA });
    expect(
      authorizeCustomerScope({
        membershipRestaurantId: restaurantA,
        customerRestaurantId: stored.restaurant_id,
        currentRestaurantId: restaurantA,
      }).ok,
    ).toBe(true);
  });
});

describe("duplicate detection during write", () => {
  const existing = [
    record({ id: customerA }),
    record({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Grace",
      phone: null,
      email: "grace@example.com",
    }),
  ];

  it("blocks creating a customer with the same phone", () => {
    expect(
      findDuplicateCustomer(existing, {
        phone: "+1 415 555 2671",
        email: null,
      })?.id,
    ).toBe(customerA);
  });

  it("blocks creating a customer with the same email", () => {
    expect(
      findDuplicateCustomer(existing, {
        phone: null,
        email: "GRACE@example.com",
      })?.match,
    ).toBe("email");
  });

  it("allows the same identifiers on the same customer during update", () => {
    expect(
      findDuplicateCustomer(
        existing,
        { phone: "+14155552671", email: "ada@example.com" },
        customerA,
      ),
    ).toBeNull();
  });

  it("exposes a duplicate summary with display phone", () => {
    const duplicate = serviceMatchIncomingDuplicate(existing[0]!, {
      phone: "+14155552671",
      email: null,
    });
    expect(duplicate).toEqual({
      id: customerA,
      name: "Ada",
      phone: "+14155552671",
      match: "phone",
    });
    expect(duplicate).not.toHaveProperty("email");
  });
});

describe("customer authorization", () => {
  it("does not let Restaurant A manage Restaurant B customers", () => {
    expect(
      authorizeCustomerScope({
        membershipRestaurantId: restaurantA,
        customerRestaurantId: restaurantB,
        currentRestaurantId: restaurantA,
      }).ok,
    ).toBe(false);
    expect(hasPermission("OWNER", "customers.manage")).toBe(true);
    expect(hasPermission("STAFF", "customers.manage")).toBe(false);
    expect(hasPermission("STAFF", "customers.view")).toBe(true);
  });

  it("does not let an unauthorized role create or update customers", () => {
    expect(hasPermission("STAFF", "customers.manage")).toBe(false);
    expect(hasPermission("MANAGER", "customers.manage")).toBe(true);
  });
});
