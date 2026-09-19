import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import { normalizeEmail } from "@/lib/utils/email";
import { isValidPhoneInput, normalizePhone } from "@/lib/utils/phone";

export const CUSTOMER_NAME_MAX = 120;
export const CUSTOMER_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_CUSTOMER_PAGE_SIZE = 20;

export const CUSTOMER_CONTACT_FILTERS = ["all", "phone", "email"] as const;
export type CustomerContactFilter = (typeof CUSTOMER_CONTACT_FILTERS)[number];

export const CUSTOMER_RECENCY_FILTERS = ["all", "today", "week"] as const;
export type CustomerRecencyFilter = (typeof CUSTOMER_RECENCY_FILTERS)[number];

export const CUSTOMER_STAT_FILTERS = [
  "all",
  "today",
  "week",
  "phone",
  "email",
] as const;
export type CustomerStatFilter = (typeof CUSTOMER_STAT_FILTERS)[number];

export const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(CUSTOMER_NAME_MAX, "Name is too long");

function emptyToString(value: unknown): unknown {
  return value == null ? "" : value;
}

const requiredPhoneInput = z.preprocess(
  emptyToString,
  z
    .string()
    .trim()
    .max(30, "Phone is too long")
    .superRefine((value, ctx) => {
      if (value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone number is required.",
        });
        return;
      }
      if (!isValidPhoneInput(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid phone number.",
        });
      }
    })
    .transform((value) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        throw new Error("Phone number is required.");
      }
      return normalized;
    }),
);

const optionalEmailInput = z.preprocess(
  emptyToString,
  z
    .string()
    .trim()
    .max(255, "Email is too long")
    .superRefine((value, ctx) => {
      if (value === "") {
        return;
      }
      const normalized = normalizeEmail(value);
      if (!normalized || !emailSchema.safeParse(normalized).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid email address",
        });
      }
    })
    .transform((value) => (value === "" ? null : normalizeEmail(value))),
);

export const customerFieldsSchema = z.object({
  name: customerNameSchema,
  phone: z
    .string()
    .trim()
    .max(30, "Phone is too long")
    .superRefine((value, ctx) => {
      if (value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone number is required.",
        });
        return;
      }
      if (!isValidPhoneInput(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid phone number.",
        });
      }
    }),
  email: z
    .string()
    .trim()
    .max(255, "Email is too long")
    .superRefine((value, ctx) => {
      if (value === "") {
        return;
      }
      const normalized = normalizeEmail(value);
      if (!normalized || !emailSchema.safeParse(normalized).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid email address",
        });
      }
    }),
});

export type CustomerFormValues = z.infer<typeof customerFieldsSchema>;

export const createCustomerSchema = z.object({
  name: customerNameSchema,
  phone: requiredPhoneInput,
  email: optionalEmailInput,
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.extend({
  customerId: z.string().uuid("Invalid customer"),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export function toCustomerFormValues(input?: {
  name?: string;
  phone?: string | null;
  email?: string | null;
}): CustomerFormValues {
  return {
    name: input?.name ?? "",
    phone: input?.phone ?? "",
    email: input?.email ?? "",
  };
}

export function toCustomerWritePayload(values: CustomerFormValues) {
  return createCustomerSchema.parse({
    name: values.name,
    phone: values.phone,
    email: values.email,
  });
}
