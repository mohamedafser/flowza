import { z } from "zod";
import {
  optionalEmailSchema,
  optionalPhoneSchema,
  slugSchema,
  timezoneSchema,
} from "@/lib/validations/restaurant";

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} is too long`);

export const branchFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Branch name must be at least 2 characters")
    .max(120, "Branch name is too long"),
  slug: slugSchema,
  addressLine1: optionalText(200, "Address line 1"),
  addressLine2: optionalText(200, "Address line 2"),
  city: optionalText(100, "City"),
  state: optionalText(100, "State"),
  postalCode: optionalText(32, "Postal code"),
  country: optionalText(100, "Country"),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  timezone: timezoneSchema,
  useRestaurantTimezone: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchFieldsSchema>;

export const createBranchSchema = branchFieldsSchema.extend({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = branchFieldsSchema.extend({
  branchId: z.string().uuid("Invalid branch"),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const setBranchStatusSchema = z.object({
  branchId: z.string().uuid("Invalid branch"),
  isActive: z.boolean(),
});

export type SetBranchStatusInput = z.infer<typeof setBranchStatusSchema>;

export const BRANCH_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_BRANCH_PAGE_SIZE = 10;

export const BRANCH_SORT_FIELDS = [
  "name",
  "created_at",
  "updated_at",
  "is_active",
] as const;

export type BranchSortField = (typeof BRANCH_SORT_FIELDS)[number];

export const branchListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, "Search is too long")
    .optional()
    .transform((value) => (value ? value : undefined)),
  city: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : undefined)),
  country: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine(
      (value) =>
        (BRANCH_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
      "Invalid page size",
    )
    .default(DEFAULT_BRANCH_PAGE_SIZE),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  sort: z.enum(BRANCH_SORT_FIELDS).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export type BranchListQuery = z.infer<typeof branchListQuerySchema>;

export function parseBranchListQuery(
  input: Record<string, string | string[] | undefined>,
): BranchListQuery {
  const pick = (key: string) => {
    const value = input[key];
    return typeof value === "string" ? value : undefined;
  };

  const parsed = branchListQuerySchema.safeParse({
    q: pick("q"),
    city: pick("city"),
    country: pick("country"),
    page: pick("page"),
    pageSize: pick("pageSize"),
    status: pick("status"),
    sort: pick("sort"),
    order: pick("order"),
  });

  if (parsed.success) {
    return parsed.data;
  }

  return {
    q: undefined,
    city: undefined,
    country: undefined,
    page: 1,
    pageSize: DEFAULT_BRANCH_PAGE_SIZE,
    status: "all",
    sort: "name",
    order: "asc",
  };
}

export function toBranchPayload(values: BranchFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    addressLine1: values.addressLine1 === "" ? null : values.addressLine1,
    addressLine2: values.addressLine2 === "" ? null : values.addressLine2,
    city: values.city === "" ? null : values.city,
    state: values.state === "" ? null : values.state,
    postalCode: values.postalCode === "" ? null : values.postalCode,
    country: values.country === "" ? null : values.country,
    phone: values.phone === "" ? null : values.phone,
    email: values.email === "" ? null : values.email,
    timezone: values.timezone,
    useRestaurantTimezone: values.useRestaurantTimezone,
  };
}
