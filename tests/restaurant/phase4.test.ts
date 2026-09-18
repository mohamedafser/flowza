import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import {
  restaurantOnboardingSchema,
  restaurantUpdateSchema,
} from "@/lib/validations/restaurant";
import {
  createBranchSchema,
  setBranchStatusSchema,
  updateBranchSchema,
} from "@/lib/validations/branch";
import {
  pickPreferredBranch,
  pickPreferredRestaurantId,
} from "@/lib/context/restaurant";
import { hasPermission } from "@/lib/auth/permissions";
import type { MembershipWithRestaurant } from "@/lib/auth/session";
import type { Branch } from "@/lib/context/restaurant";

function membership(
  restaurantId: string,
  role: MembershipWithRestaurant["role"] = "OWNER",
): MembershipWithRestaurant {
  return {
    id: `m-${restaurantId}`,
    restaurant_id: restaurantId,
    user_id: "user-1",
    role,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    restaurant: {
      id: restaurantId,
      name: `Restaurant ${restaurantId}`,
      slug: `restaurant-${restaurantId}`,
      logo_url: null,
      email: "a@example.com",
      phone: "+10000000000",
      website: null,
      description: null,
      timezone: "UTC",
      currency: "USD",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function branch(id: string, restaurantId: string, isActive: boolean): Branch {
  return {
    id,
    restaurant_id: restaurantId,
    name: `Branch ${id}`,
    slug: `branch-${id}`,
    address_line_1: null,
    address_line_2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    phone: null,
    email: null,
    timezone: "UTC",
    use_restaurant_timezone: true,
    is_active: isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("restaurant validation", () => {
  it("accepts a valid onboarding payload", () => {
    const parsed = restaurantOnboardingSchema.safeParse({
      name: "Harbor Kitchen",
      email: "hello@harbor.test",
      phone: "+1 555 0100",
      website: "harbor.test",
      description: "Seafood",
      currency: "USD",
      timezone: "UTC",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe("USD");
      expect(parsed.data.website).toBe("harbor.test");
    }
  });

  it("rejects invalid email and currency", () => {
    const parsed = restaurantOnboardingSchema.safeParse({
      name: "X",
      email: "not-an-email",
      phone: "123",
      website: "",
      description: "",
      currency: "XX",
      timezone: "Not/AZone",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires restaurantId for updates", () => {
    const parsed = restaurantUpdateSchema.safeParse({
      restaurantId: "not-a-uuid",
      name: "Harbor Kitchen",
      email: "hello@harbor.test",
      phone: "+15550100",
      website: "",
      description: "",
      currency: "USD",
      timezone: "UTC",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("branch validation", () => {
  it("accepts a valid create payload", () => {
    const parsed = createBranchSchema.safeParse({
      restaurantId: "11111111-1111-1111-1111-111111111111",
      name: "Downtown",
      slug: "downtown",
      addressLine1: "1 Main St",
      addressLine2: "",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
      phone: "",
      email: "",
      timezone: "UTC",
      useRestaurantTimezone: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid slug format", () => {
    const parsed = updateBranchSchema.safeParse({
      branchId: "22222222-2222-2222-2222-222222222222",
      name: "Downtown",
      slug: "Bad Slug",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: "",
      email: "",
      timezone: "UTC",
    });
    expect(parsed.success).toBe(false);
  });

  it("validates activation payload", () => {
    expect(
      setBranchStatusSchema.safeParse({
        branchId: "22222222-2222-2222-2222-222222222222",
        isActive: false,
      }).success,
    ).toBe(true);
  });
});

describe("slug helpers", () => {
  it("slugifies names", () => {
    expect(slugify("Harbor Kitchen!")).toBe("harbor-kitchen");
    expect(slugify("  ")).toBe("item");
  });

  it("avoids duplicate slugs", () => {
    const existing = new Set(["downtown", "downtown-2"]);
    expect(uniqueSlug("Downtown", existing)).toBe("downtown-3");
  });
});

describe("restaurant/branch context selection", () => {
  it("auto-selects a single restaurant", () => {
    const memberships = [membership("r1")];
    expect(pickPreferredRestaurantId(memberships, null)).toBe("r1");
  });

  it("honors a valid preferred restaurant and ignores foreign ids", () => {
    const memberships = [membership("r1"), membership("r2")];
    expect(pickPreferredRestaurantId(memberships, "r2")).toBe("r2");
    expect(pickPreferredRestaurantId(memberships, "evil")).toBe("r1");
  });

  it("selects only active branches", () => {
    const branches = [
      branch("b1", "r1", false),
      branch("b2", "r1", true),
      branch("b3", "r1", true),
    ];
    expect(pickPreferredBranch(branches, "b1")?.id).toBe("b2");
    expect(pickPreferredBranch(branches, "b3")?.id).toBe("b3");
  });

  it("returns null when no active branches exist", () => {
    expect(pickPreferredBranch([branch("b1", "r1", false)], "b1")).toBeNull();
  });
});

describe("restaurant management RBAC", () => {
  it("allows OWNER and ADMIN to manage restaurant/branches", () => {
    expect(hasPermission("OWNER", "restaurant.manage")).toBe(true);
    expect(hasPermission("ADMIN", "restaurant.manage")).toBe(true);
  });

  it("denies MANAGER and STAFF restaurant management", () => {
    expect(hasPermission("MANAGER", "restaurant.manage")).toBe(false);
    expect(hasPermission("STAFF", "restaurant.manage")).toBe(false);
  });
});

describe("multi-tenant restaurant isolation contract", () => {
  it("never authorizes a foreign restaurant id from memberships alone", () => {
    const memberships = [membership("r-a", "OWNER")];
    expect(pickPreferredRestaurantId(memberships, "r-b")).toBe("r-a");
    expect(memberships.some((item) => item.restaurant_id === "r-b")).toBe(
      false,
    );
  });
});
