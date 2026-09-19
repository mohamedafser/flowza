import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import { TIMEZONES, isValidTimezone } from "@/lib/utils/timezone";

export { TIMEZONES, isValidTimezone };

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .max(30, "Phone is too long")
  .regex(/^[+]?[\d\s().-]{7,}$/, "Enter a valid phone number");

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(30, "Phone is too long")
  .refine(
    (value) => value === "" || /^[+]?[\d\s().-]{7,}$/.test(value),
    "Enter a valid phone number",
  );

export const optionalEmailSchema = z
  .string()
  .trim()
  .max(255, "Email is too long")
  .refine(
    (value) => value === "" || emailSchema.safeParse(value).success,
    "Enter a valid email address",
  );

export function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const websiteSchema = z
  .string()
  .max(500, "Website URL is too long")
  .refine((value) => {
    const normalized = normalizeWebsite(value);
    return (
      normalized === null || z.string().url().safeParse(normalized).success
    );
  }, "Enter a valid website URL");

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .refine(isValidTimezone, "Select a valid timezone");

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(80, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and hyphens",
  );

/** Form / action input shape (string fields). */
export const restaurantFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Restaurant name must be at least 2 characters")
    .max(120, "Restaurant name is too long"),
  email: emailSchema,
  phone: phoneSchema,
  website: websiteSchema,
  description: z.string().trim().max(1000, "Description is too long"),
  timezone: timezoneSchema,
});

export type RestaurantFormValues = z.infer<typeof restaurantFormSchema>;

export const restaurantOnboardingSchema = restaurantFormSchema;

export type RestaurantOnboardingInput = RestaurantFormValues;

export const restaurantUpdateSchema = restaurantFormSchema.extend({
  restaurantId: z.string().uuid("Invalid restaurant"),
});

export type RestaurantUpdateInput = z.infer<typeof restaurantUpdateSchema>;

export function toRestaurantPayload(values: RestaurantFormValues) {
  return {
    name: values.name,
    email: values.email,
    phone: values.phone,
    website: normalizeWebsite(values.website),
    description: values.description === "" ? null : values.description,
    timezone: values.timezone,
  };
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type LogoMimeType = (typeof LOGO_ALLOWED_MIME_TYPES)[number];

export function isAllowedLogoMimeType(value: string): value is LogoMimeType {
  return (LOGO_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}
