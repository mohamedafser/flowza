import { hasPermission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";
import { getZonedDateParts } from "@/lib/utils/datetime";
import { emailsMatch, normalizeEmail } from "@/lib/utils/email";
import {
  normalizePhone,
  phoneSearchDigits,
  phonesMatch,
} from "@/lib/utils/phone";
import type {
  CustomerRecencyFilter,
  CustomerStatFilter,
} from "@/lib/validations/customer";

export type CustomerRecord = {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Visit stats are reserved for queue/reservation history.
 * `null` means history is not available yet — never invent zeros.
 */
export type CustomerVisitSummary = {
  visitCount: number | null;
  lastVisitAt: string | null;
};

export type CustomerListItem = CustomerRecord & {
  visits: CustomerVisitSummary;
};

export type CustomerDuplicateMatch = "phone" | "email";

export type CustomerDuplicate = {
  id: string;
  name: string;
  phone: string | null;
  match: CustomerDuplicateMatch;
};

export type CustomerStats = {
  total: number;
  addedToday: number;
  addedThisWeek: number;
  withPhone: number;
  withEmail: number;
};

export type CustomerFilters = {
  search?: string;
  stat?: CustomerStatFilter;
};

export type CustomerScopeInput = {
  membershipRestaurantId: string;
  customerRestaurantId: string;
  currentRestaurantId: string;
};

export type CustomerScopeResult =
  { ok: true } | { ok: false; reason: "restaurant" };

export function emptyVisitSummary(): CustomerVisitSummary {
  return { visitCount: null, lastVisitAt: null };
}

export function withVisitPlaceholder(
  customer: CustomerRecord,
): CustomerListItem {
  return { ...customer, visits: emptyVisitSummary() };
}

export function canViewCustomers(role: MemberRole): boolean {
  return hasPermission(role, "customers.view");
}

export function canManageCustomers(role: MemberRole): boolean {
  return hasPermission(role, "customers.manage");
}

export function authorizeCustomerScope(
  input: CustomerScopeInput,
): CustomerScopeResult {
  if (
    input.membershipRestaurantId !== input.currentRestaurantId ||
    input.customerRestaurantId !== input.currentRestaurantId
  ) {
    return { ok: false, reason: "restaurant" };
  }
  return { ok: true };
}

export function addCalendarDays(date: string, days: number): string {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = String(next.getUTCFullYear()).padStart(4, "0");
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isoWeekStartDate(date: string, weekday: number): string {
  return addCalendarDays(date, 1 - weekday);
}

export function zonedCalendarDate(
  instant: Date,
  timeZone: string,
): { date: string; weekday: number } {
  const parts = getZonedDateParts(instant, timeZone);
  return { date: parts.date, weekday: parts.weekday };
}

export function customerCreatedDate(
  customer: Pick<CustomerRecord, "created_at">,
  timeZone: string,
): string {
  return zonedCalendarDate(new Date(customer.created_at), timeZone).date;
}

function recencyForStat(stat: CustomerStatFilter): CustomerRecencyFilter {
  if (stat === "today" || stat === "week") {
    return stat;
  }
  return "all";
}

export function deriveCustomerStatistics(
  customers: readonly CustomerRecord[],
  timeZone: string,
  now: Date = new Date(),
): CustomerStats {
  const today = zonedCalendarDate(now, timeZone);
  const weekStart = isoWeekStartDate(today.date, today.weekday);

  let addedToday = 0;
  let addedThisWeek = 0;
  let withPhone = 0;
  let withEmail = 0;

  for (const customer of customers) {
    const created = customerCreatedDate(customer, timeZone);
    if (created === today.date) {
      addedToday += 1;
    }
    if (created >= weekStart && created <= today.date) {
      addedThisWeek += 1;
    }
    if (customer.phone) {
      withPhone += 1;
    }
    if (customer.email) {
      withEmail += 1;
    }
  }

  return {
    total: customers.length,
    addedToday,
    addedThisWeek,
    withPhone,
    withEmail,
  };
}

export function matchesCustomerSearch(
  customer: Pick<CustomerRecord, "name" | "phone" | "email">,
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  if (customer.name.toLowerCase().includes(query)) {
    return true;
  }

  if (customer.email?.toLowerCase().includes(query)) {
    return true;
  }

  if (customer.phone?.toLowerCase().includes(query)) {
    return true;
  }

  const queryDigits = phoneSearchDigits(query);
  if (queryDigits.length >= 3) {
    const phoneDigits = phoneSearchDigits(customer.phone);
    if (phoneDigits.includes(queryDigits)) {
      return true;
    }
  }

  return false;
}

export function filterCustomers(
  customers: readonly CustomerListItem[],
  filters: CustomerFilters,
  timeZone: string,
  now: Date = new Date(),
): CustomerListItem[] {
  const search = filters.search ?? "";
  const stat = filters.stat ?? "all";
  const recency = recencyForStat(stat);
  const today = zonedCalendarDate(now, timeZone);
  const weekStart = isoWeekStartDate(today.date, today.weekday);

  return customers.filter((customer) => {
    if (!matchesCustomerSearch(customer, search)) {
      return false;
    }

    if (stat === "phone" && !customer.phone) {
      return false;
    }
    if (stat === "email" && !customer.email) {
      return false;
    }

    if (recency !== "all") {
      const created = customerCreatedDate(customer, timeZone);
      if (recency === "today" && created !== today.date) {
        return false;
      }
      if (recency === "week" && (created < weekStart || created > today.date)) {
        return false;
      }
    }

    return true;
  });
}

export function paginateCustomers<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): { items: T[]; page: number; totalPages: number; total: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages: total === 0 ? 1 : totalPages,
    total,
  };
}

export function duplicateMatchFor(
  candidate: Pick<CustomerRecord, "phone" | "email">,
  input: { phone: string | null; email: string | null },
): CustomerDuplicateMatch | null {
  if (input.phone && phonesMatch(candidate.phone, input.phone)) {
    return "phone";
  }
  if (input.email && emailsMatch(candidate.email, input.email)) {
    return "email";
  }
  return null;
}

/**
 * Phone matches win over email matches. Does not merge records.
 */
export function findDuplicateCustomer(
  customers: readonly CustomerRecord[],
  input: { phone: string | null; email: string | null },
  excludeId?: string,
): CustomerDuplicate | null {
  if (!input.phone && !input.email) {
    return null;
  }

  let emailMatch: CustomerDuplicate | null = null;

  for (const customer of customers) {
    if (excludeId && customer.id === excludeId) {
      continue;
    }
    const match = duplicateMatchFor(customer, input);
    if (match === "phone") {
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        match,
      };
    }
    if (match === "email" && !emailMatch) {
      emailMatch = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        match,
      };
    }
  }

  return emailMatch;
}

export function duplicateCustomerMessage(
  match: CustomerDuplicateMatch,
): string {
  return match === "phone"
    ? "Customer already exists."
    : "A customer with this email already exists.";
}

export function customerAuditMetadata(input: {
  hasPhone: boolean;
  hasEmail: boolean;
  changedFields?: string[];
}): Record<string, boolean | string[] | number> {
  const metadata: Record<string, boolean | string[] | number> = {
    hasPhone: input.hasPhone,
    hasEmail: input.hasEmail,
  };
  if (input.changedFields && input.changedFields.length > 0) {
    metadata.changedFields = input.changedFields;
  }
  return metadata;
}

export function changedCustomerFields(
  previous: Pick<CustomerRecord, "name" | "phone" | "email">,
  next: Pick<CustomerRecord, "name" | "phone" | "email">,
): string[] {
  const fields: string[] = [];
  if (previous.name !== next.name) fields.push("name");
  if (normalizePhone(previous.phone) !== normalizePhone(next.phone)) {
    fields.push("phone");
  }
  if (normalizeEmail(previous.email) !== normalizeEmail(next.email)) {
    fields.push("email");
  }
  return fields;
}
