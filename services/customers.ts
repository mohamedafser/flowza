import { cache } from "react";
import {
  AuthorizationError,
  requirePermission,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import type { Restaurant } from "@/lib/auth/session";
import { safeDatabaseMessage } from "@/lib/errors/action";
import { createClient } from "@/lib/supabase/server";
import {
  authorizeCustomerScope,
  changedCustomerFields,
  customerAuditMetadata,
  deriveCustomerStatistics,
  duplicateCustomerMessage,
  duplicateMatchFor,
  withVisitPlaceholder,
  type CustomerDuplicate,
  type CustomerListItem,
  type CustomerRecord,
  type CustomerStats,
} from "@/lib/utils/customers";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/validations/customer";
import { writeAuditLog } from "@/services/audit";
import type { Tables } from "@/types/database";

export type {
  CustomerDuplicate,
  CustomerListItem,
  CustomerRecord,
  CustomerStats,
};

export type CustomersBundle = {
  restaurant: Restaurant;
  timezone: string;
  customers: CustomerListItem[];
  stats: CustomerStats;
};

export type CustomerMutationCode =
  "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "UNKNOWN";

export type CustomerMutationResult =
  | { ok: true; customer: CustomerRecord }
  | {
      ok: false;
      message: string;
      code: CustomerMutationCode;
      existingCustomer?: CustomerDuplicate;
    };

type CustomerRow = Tables<"customers">;

function asCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function requireCurrentRestaurant(
  permission: "customers.view" | "customers.manage",
) {
  const auth = await requireVerifiedAuth();
  if (!auth.restaurant) {
    throw new AuthorizationError(
      "NO_MEMBERSHIP",
      "You do not belong to this restaurant.",
    );
  }

  const context = await requirePermission(auth.restaurant.id, permission);
  return { restaurant: auth.restaurant, context };
}

async function loadAuthorizedCustomer(
  customerId: string,
  permission: "customers.view" | "customers.manage",
) {
  const { restaurant, context } = await requireCurrentRestaurant(permission);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const scoped = authorizeCustomerScope({
    membershipRestaurantId: context.membership.restaurant_id,
    customerRestaurantId: data.restaurant_id,
    currentRestaurantId: restaurant.id,
  });

  if (!scoped.ok) {
    return null;
  }

  return { customer: asCustomer(data), restaurant, context };
}

export async function findPotentialDuplicateCustomer(
  restaurantId: string,
  input: { phone: string | null; email: string | null },
  excludeId?: string,
): Promise<CustomerDuplicate | null> {
  if (!input.phone && !input.email) {
    return null;
  }

  const supabase = await createClient();

  if (input.phone) {
    let phoneQuery = supabase
      .from("customers")
      .select("id, name, phone")
      .eq("restaurant_id", restaurantId)
      .eq("phone", input.phone);
    if (excludeId) {
      phoneQuery = phoneQuery.neq("id", excludeId);
    }
    const { data } = await phoneQuery.limit(1).maybeSingle();
    if (data) {
      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        match: "phone",
      };
    }
  }

  if (input.email) {
    let emailQuery = supabase
      .from("customers")
      .select("id, name, phone")
      .eq("restaurant_id", restaurantId)
      .eq("email", input.email);
    if (excludeId) {
      emailQuery = emailQuery.neq("id", excludeId);
    }
    const { data } = await emailQuery.limit(1).maybeSingle();
    if (data) {
      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        match: "email",
      };
    }
  }

  return null;
}

export const getCustomersBundle = cache(
  async (restaurantId: string): Promise<CustomersBundle> => {
    const context = await requirePermission(restaurantId, "customers.view");
    const restaurant = context.membership.restaurant;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      throw new Error("Unable to load customers.");
    }

    const customers = (data ?? []).map((row) =>
      withVisitPlaceholder(asCustomer(row)),
    );

    return {
      restaurant,
      timezone: restaurant.timezone || "UTC",
      customers,
      stats: deriveCustomerStatistics(customers, restaurant.timezone || "UTC"),
    };
  },
);

export async function getCustomers(
  restaurantId: string,
): Promise<CustomerListItem[]> {
  const bundle = await getCustomersBundle(restaurantId);
  return bundle.customers;
}

export async function getCustomerStats(
  restaurantId: string,
): Promise<CustomerStats> {
  const bundle = await getCustomersBundle(restaurantId);
  return bundle.stats;
}

export const getCustomer = cache(
  async (customerId: string): Promise<CustomerListItem | null> => {
    const loaded = await loadAuthorizedCustomer(customerId, "customers.view");
    if (!loaded) {
      return null;
    }
    return withVisitPlaceholder(loaded.customer);
  },
);

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<CustomerMutationResult> {
  const { restaurant, context } =
    await requireCurrentRestaurant("customers.manage");

  const duplicate = await findPotentialDuplicateCustomer(restaurant.id, {
    phone: input.phone,
    email: input.email,
  });

  if (duplicate) {
    return {
      ok: false,
      code: "CONFLICT",
      message: duplicateCustomerMessage(duplicate.match),
      existingCustomer: duplicate,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      restaurant_id: restaurant.id,
      name: input.name,
      phone: input.phone,
      email: input.email,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /duplicate key|unique/i.test(error.message)
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create customer. Please try again.",
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create customer. Please try again.",
    };
  }

  const customer = asCustomer(data);
  await writeAuditLog({
    restaurantId: restaurant.id,
    userId: context.user.id,
    action: "customer.created",
    entityType: "customer",
    entityId: customer.id,
    metadata: customerAuditMetadata({
      hasPhone: Boolean(customer.phone),
      hasEmail: Boolean(customer.email),
    }),
  });

  return { ok: true, customer };
}

export async function updateCustomer(
  input: UpdateCustomerInput,
): Promise<CustomerMutationResult> {
  const loaded = await loadAuthorizedCustomer(
    input.customerId,
    "customers.manage",
  );
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Customer not found." };
  }

  const duplicate = await findPotentialDuplicateCustomer(
    loaded.restaurant.id,
    { phone: input.phone, email: input.email },
    loaded.customer.id,
  );

  if (duplicate) {
    return {
      ok: false,
      code: "CONFLICT",
      message: duplicateCustomerMessage(duplicate.match),
      existingCustomer: duplicate,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: input.name,
      phone: input.phone,
      email: input.email,
    })
    .eq("id", loaded.customer.id)
    .eq("restaurant_id", loaded.restaurant.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /duplicate key|unique/i.test(error.message)
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update customer. Please try again.",
      ),
    };
  }

  if (!data) {
    return { ok: false, code: "NOT_FOUND", message: "Customer not found." };
  }

  const customer = asCustomer(data);
  const changedFields = changedCustomerFields(loaded.customer, customer);
  await writeAuditLog({
    restaurantId: loaded.restaurant.id,
    userId: loaded.context.user.id,
    action: "customer.updated",
    entityType: "customer",
    entityId: customer.id,
    metadata: customerAuditMetadata({
      hasPhone: Boolean(customer.phone),
      hasEmail: Boolean(customer.email),
      changedFields,
    }),
  });

  return { ok: true, customer };
}

export function matchIncomingDuplicate(
  candidate: Pick<CustomerRecord, "id" | "name" | "phone" | "email">,
  input: { phone: string | null; email: string | null },
): CustomerDuplicate | null {
  const match = duplicateMatchFor(candidate, input);
  if (!match) {
    return null;
  }
  return {
    id: candidate.id,
    name: candidate.name,
    phone: candidate.phone,
    match,
  };
}
