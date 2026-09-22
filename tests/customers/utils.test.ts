import { describe, expect, it } from "vitest";
import {
  isValidNormalizedPhone,
  isValidPhoneInput,
  normalizePhone,
  phonesMatch,
} from "@/lib/utils/phone";
import { emailsMatch, normalizeEmail } from "@/lib/utils/email";
import {
  authorizeCustomerScope,
  canManageCustomers,
  canViewCustomers,
  customerAuditMetadata,
  deriveCustomerStatistics,
  emptyVisitSummary,
  filterCustomers,
  findDuplicateCustomer,
  matchesCustomerSearch,
  paginateCustomers,
  withVisitPlaceholder,
  type CustomerListItem,
  type CustomerRecord,
} from "@/lib/utils/customers";
import { isSensitiveAuditKey } from "@/services/audit";

function customer(
  partial: Partial<CustomerRecord> & { id: string; name: string },
): CustomerListItem {
  return withVisitPlaceholder({
    organization_id: "org-a",
    restaurant_id: "rest-a",
    phone: null,
    email: null,
    created_at: "2026-09-18T10:00:00.000Z",
    updated_at: "2026-09-18T10:00:00.000Z",
    ...partial,
  });
}

describe("phone normalization", () => {
  it("normalizes international numbers to E.164", () => {
    expect(normalizePhone("+1 415 555 2671")).toBe("+14155552671");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("applies the default country for national numbers", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
  });

  it("validates phone numbers with libphonenumber", () => {
    expect(isValidNormalizedPhone("+14155552671")).toBe(true);
    expect(isValidNormalizedPhone("+0123")).toBe(false);
    expect(isValidPhoneInput("abc")).toBe(false);
    expect(isValidPhoneInput("+1 415 555 2671")).toBe(true);
    expect(isValidPhoneInput("9876543210")).toBe(true);
  });

  it("matches equivalent formatted numbers", () => {
    expect(phonesMatch("+91 98765 43210", "+919876543210")).toBe(true);
    expect(phonesMatch("9876543210", "+919876543210")).toBe(true);
    expect(phonesMatch("+14155552671", "+919876543210")).toBe(false);
  });
});

describe("email normalization", () => {
  it("trims and lowercases without changing unrelated text", () => {
    expect(normalizeEmail("  Ada.Lovelace@Example.COM ")).toBe(
      "ada.lovelace@example.com",
    );
    expect(normalizeEmail("")).toBeNull();
    expect(emailsMatch("Ada@Example.com", "ada@example.com")).toBe(true);
  });
});

describe("customer permissions", () => {
  it("lets staff view customers but not manage them", () => {
    expect(canViewCustomers("STAFF")).toBe(true);
    expect(canManageCustomers("STAFF")).toBe(false);
    expect(canManageCustomers("MANAGER")).toBe(true);
    expect(canManageCustomers("ADMIN")).toBe(true);
    expect(canViewCustomers("OWNER")).toBe(true);
  });
});

describe("customer search and filters", () => {
  const sample: CustomerListItem[] = [
    customer({
      id: "c1",
      name: "Ada Lovelace",
      phone: "+14155552671",
      email: "ada@example.com",
      created_at: "2026-09-18T08:00:00.000Z",
    }),
    customer({
      id: "c2",
      name: "Grace Hopper",
      phone: "+442079460958",
      created_at: "2026-09-16T08:00:00.000Z",
    }),
    customer({
      id: "c3",
      name: "Alan Turing",
      email: "alan@example.com",
      created_at: "2026-09-01T08:00:00.000Z",
    }),
  ];

  it("searches by name, phone, and email", () => {
    expect(
      sample
        .filter((item) => matchesCustomerSearch(item, "ada"))
        .map((i) => i.id),
    ).toEqual(["c1"]);
    expect(
      sample
        .filter((item) => matchesCustomerSearch(item, "415555"))
        .map((item) => item.id),
    ).toEqual(["c1"]);
    expect(
      sample
        .filter((item) => matchesCustomerSearch(item, "ALAN@EXAMPLE.COM"))
        .map((item) => item.id),
    ).toEqual(["c3"]);
    expect(
      sample.filter((item) => matchesCustomerSearch(item, "nope")),
    ).toEqual([]);
  });

  it("filters by contact and recency from a single dataset", () => {
    const now = new Date("2026-09-18T15:00:00.000Z");
    expect(
      filterCustomers(sample, { stat: "phone" }, "UTC", now).map(
        (item) => item.id,
      ),
    ).toEqual(["c1", "c2"]);
    expect(
      filterCustomers(sample, { stat: "email" }, "UTC", now).map(
        (item) => item.id,
      ),
    ).toEqual(["c1", "c3"]);
    expect(
      filterCustomers(sample, { stat: "today" }, "UTC", now).map(
        (item) => item.id,
      ),
    ).toEqual(["c1"]);
    expect(
      filterCustomers(sample, { stat: "week" }, "UTC", now).map(
        (item) => item.id,
      ),
    ).toEqual(["c1", "c2"]);
  });

  it("combines search with a statistic filter", () => {
    const now = new Date("2026-09-18T15:00:00.000Z");
    expect(
      filterCustomers(
        sample,
        { search: "example.com", stat: "phone" },
        "UTC",
        now,
      ).map((item) => item.id),
    ).toEqual(["c1"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterCustomers(sample, { search: "zzz" }, "UTC")).toEqual([]);
  });
});

describe("customer statistics", () => {
  it("derives all cards from one loaded dataset", () => {
    const now = new Date("2026-09-18T15:00:00.000Z");
    const stats = deriveCustomerStatistics(
      [
        customer({
          id: "c1",
          name: "Ada",
          phone: "+15550100",
          email: "ada@example.com",
          created_at: "2026-09-18T08:00:00.000Z",
        }),
        customer({
          id: "c2",
          name: "Grace",
          phone: "+44207946",
          created_at: "2026-09-16T08:00:00.000Z",
        }),
        customer({
          id: "c3",
          name: "Alan",
          created_at: "2026-08-01T08:00:00.000Z",
        }),
      ],
      "UTC",
      now,
    );

    expect(stats).toEqual({
      total: 3,
      addedToday: 1,
      addedThisWeek: 2,
      withPhone: 2,
      withEmail: 1,
    });
  });
});

describe("duplicate detection", () => {
  const records: CustomerRecord[] = [
    customer({
      id: "c1",
      name: "Ada Lovelace",
      phone: "+14155552671",
      email: "ada@example.com",
    }),
    customer({
      id: "c2",
      name: "Grace Hopper",
      email: "grace@example.com",
    }),
  ];

  it("prefers a normalized phone match over email", () => {
    const match = findDuplicateCustomer(records, {
      phone: "+1 415 555 2671",
      email: "grace@example.com",
    });
    expect(match).toEqual({
      id: "c1",
      name: "Ada Lovelace",
      phone: "+14155552671",
      match: "phone",
    });
  });

  it("falls back to a normalized email match", () => {
    expect(
      findDuplicateCustomer(records, {
        phone: null,
        email: "  GRACE@example.com ",
      }),
    ).toEqual({
      id: "c2",
      name: "Grace Hopper",
      phone: null,
      match: "email",
    });
  });

  it("ignores the current customer when updating", () => {
    expect(
      findDuplicateCustomer(
        records,
        { phone: "+14155552671", email: null },
        "c1",
      ),
    ).toBeNull();
  });

  it("does not match across empty identifiers", () => {
    expect(
      findDuplicateCustomer(records, { phone: null, email: null }),
    ).toBeNull();
  });
});

describe("restaurant isolation", () => {
  it("rejects a customer from another restaurant", () => {
    expect(
      authorizeCustomerScope({
        membershipRestaurantId: "rest-a",
        customerRestaurantId: "rest-b",
        currentRestaurantId: "rest-a",
      }),
    ).toEqual({ ok: false, reason: "restaurant" });
  });

  it("rejects a claimed restaurant that is not the current workspace", () => {
    expect(
      authorizeCustomerScope({
        membershipRestaurantId: "rest-b",
        customerRestaurantId: "rest-b",
        currentRestaurantId: "rest-a",
      }),
    ).toEqual({ ok: false, reason: "restaurant" });
  });

  it("allows a customer that belongs to the current restaurant", () => {
    expect(
      authorizeCustomerScope({
        membershipRestaurantId: "rest-a",
        customerRestaurantId: "rest-a",
        currentRestaurantId: "rest-a",
      }),
    ).toEqual({ ok: true });
  });
});

describe("pagination and visit placeholders", () => {
  it("does not invent visit counts", () => {
    expect(emptyVisitSummary()).toEqual({
      visitCount: null,
      lastVisitAt: null,
    });
  });

  it("pages a filtered list without extra fetches", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateCustomers(items, 2, 2)).toEqual({
      items: [3, 4],
      page: 2,
      totalPages: 3,
      total: 5,
    });
  });
});

describe("privacy", () => {
  it("keeps phone and email out of audit metadata", () => {
    expect(customerAuditMetadata({ hasPhone: true, hasEmail: false })).toEqual({
      hasPhone: true,
      hasEmail: false,
    });
    expect(isSensitiveAuditKey("phone")).toBe(true);
    expect(isSensitiveAuditKey("email")).toBe(true);
    expect(isSensitiveAuditKey("customerPhone")).toBe(true);
    expect(isSensitiveAuditKey("hasPhone")).toBe(false);
    expect(isSensitiveAuditKey("hasEmail")).toBe(false);
    expect(isSensitiveAuditKey("changedFields")).toBe(false);
  });
});
