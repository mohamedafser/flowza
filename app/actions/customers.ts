"use server";

import { revalidatePath } from "next/cache";
import {
  actionFail,
  actionOk,
  mapUnknownError,
  type ActionResult,
} from "@/lib/errors/action";
import { AuthorizationError } from "@/lib/auth/guards";
import { DASHBOARD_CUSTOMERS_PATH } from "@/lib/auth/paths";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/lib/validations/customer";
import {
  createCustomer,
  updateCustomer,
  type CustomerDuplicate,
  type CustomerRecord,
} from "@/services/customers";

function revalidateCustomers(customerId?: string) {
  revalidatePath(DASHBOARD_CUSTOMERS_PATH);
  revalidatePath(DASHBOARD_CUSTOMERS_PATH, "layout");
  if (customerId) {
    revalidatePath(`${DASHBOARD_CUSTOMERS_PATH}/${customerId}`);
  }
  revalidatePath("/", "layout");
}

export type CustomerWriteData = {
  customer?: CustomerRecord;
  existingCustomer?: CustomerDuplicate;
};

export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult<CustomerWriteData>> {
  try {
    const parsed = createCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid customer details.",
      );
    }

    const result = await createCustomer(parsed.data);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        data: result.existingCustomer
          ? { existingCustomer: result.existingCustomer }
          : undefined,
      };
    }

    revalidateCustomers(result.customer.id);
    return actionOk({ customer: result.customer });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to create customer.");
  }
}

export async function updateCustomerAction(
  input: unknown,
): Promise<ActionResult<CustomerWriteData>> {
  try {
    const parsed = updateCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return actionFail(
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "Invalid customer details.",
      );
    }

    const result = await updateCustomer(parsed.data);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        data: result.existingCustomer
          ? { existingCustomer: result.existingCustomer }
          : undefined,
      };
    }

    revalidateCustomers(result.customer.id);
    return actionOk({ customer: result.customer });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return actionFail(error.code, error.message);
    }
    return mapUnknownError(error, "Unable to update customer.");
  }
}
