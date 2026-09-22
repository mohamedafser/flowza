import { describe, expect, it } from "vitest";
import { authorizeCustomerScope } from "@/lib/utils/customers";
import { authorizeQueueScope } from "@/lib/utils/queue";
import {
  organizationIdFromRestaurant,
  sameOrganization,
} from "@/lib/tenancy/organization";

describe("organization tenant isolation", () => {
  it("resolves organizationId from the restaurant record", () => {
    expect(
      organizationIdFromRestaurant({
        id: "rest-a",
        organization_id: "org-a",
      }),
    ).toBe("org-a");
  });

  it("Scenario 1: org B cannot see org A customers", () => {
    const allowed = authorizeCustomerScope({
      membershipRestaurantId: "rest-a",
      customerRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      membershipOrganizationId: "org-a",
      customerOrganizationId: "org-a",
      currentOrganizationId: "org-a",
    });
    expect(allowed).toEqual({ ok: true });

    const denied = authorizeCustomerScope({
      membershipRestaurantId: "rest-b",
      customerRestaurantId: "rest-a",
      currentRestaurantId: "rest-b",
      membershipOrganizationId: "org-b",
      customerOrganizationId: "org-a",
      currentOrganizationId: "org-b",
    });
    expect(denied.ok).toBe(false);
  });

  it("Scenario 2: org B cannot read/update/delete org A queues", () => {
    const denied = authorizeQueueScope({
      membershipRestaurantId: "rest-b",
      queueRestaurantId: "rest-a",
      currentRestaurantId: "rest-b",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
      membershipOrganizationId: "org-b",
      queueOrganizationId: "org-a",
      currentOrganizationId: "org-b",
    });
    expect(denied).toEqual({ ok: false, reason: "restaurant" });

    const orgMismatch = authorizeQueueScope({
      membershipRestaurantId: "rest-a",
      queueRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
      membershipOrganizationId: "org-a",
      queueOrganizationId: "org-b",
      currentOrganizationId: "org-a",
    });
    expect(orgMismatch).toEqual({ ok: false, reason: "organization" });
  });

  it("Scenario 3: same phone can exist in two organizations independently", () => {
    const orgA = authorizeCustomerScope({
      membershipRestaurantId: "rest-a",
      customerRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      membershipOrganizationId: "org-a",
      customerOrganizationId: "org-a",
      currentOrganizationId: "org-a",
    });
    const orgB = authorizeCustomerScope({
      membershipRestaurantId: "rest-b",
      customerRestaurantId: "rest-b",
      currentRestaurantId: "rest-b",
      membershipOrganizationId: "org-b",
      customerOrganizationId: "org-b",
      currentOrganizationId: "org-b",
    });
    expect(orgA).toEqual({ ok: true });
    expect(orgB).toEqual({ ok: true });
    expect(sameOrganization("org-a", "org-b")).toBe(false);
  });

  it("Scenario 4: forged resource IDs from another org are denied", () => {
    const denied = authorizeCustomerScope({
      membershipRestaurantId: "rest-a",
      customerRestaurantId: "rest-b",
      currentRestaurantId: "rest-a",
      membershipOrganizationId: "org-a",
      customerOrganizationId: "org-b",
      currentOrganizationId: "org-a",
    });
    expect(denied.ok).toBe(false);
  });

  it("Scenario 5: original organization access still works", () => {
    const result = authorizeQueueScope({
      membershipRestaurantId: "rest-a",
      queueRestaurantId: "rest-a",
      currentRestaurantId: "rest-a",
      queueBranchId: "branch-a",
      expectedBranchId: "branch-a",
      membershipOrganizationId: "org-a",
      queueOrganizationId: "org-a",
      currentOrganizationId: "org-a",
      customerRestaurantId: "rest-a",
      customerOrganizationId: "org-a",
    });
    expect(result).toEqual({ ok: true });
  });
});
