import { z } from "zod";
import { customerNameSchema } from "@/lib/validations/customer";
import { MAX_PARTY_SIZE, partySizeSchema } from "@/lib/validations/queue";
import { slugSchema } from "@/lib/validations/restaurant";
import { isValidNormalizedPhone, normalizePhone } from "@/lib/utils/phone";
import {
  PUBLIC_QUEUE_ACCESS_TOKEN_MAX,
  PUBLIC_QUEUE_ACCESS_TOKEN_MIN,
  PUBLIC_QUEUE_ACCESS_TOKEN_PATTERN,
} from "@/lib/public-queue/paths";

export const publicBranchSlugParamsSchema = z.object({
  restaurantSlug: slugSchema,
  branchSlug: slugSchema,
});

export type PublicBranchSlugParams = z.infer<
  typeof publicBranchSlugParamsSchema
>;

export const publicAccessTokenSchema = z
  .string()
  .trim()
  .min(PUBLIC_QUEUE_ACCESS_TOKEN_MIN, "This queue link is invalid.")
  .max(PUBLIC_QUEUE_ACCESS_TOKEN_MAX, "This queue link is invalid.")
  .regex(PUBLIC_QUEUE_ACCESS_TOKEN_PATTERN, "This queue link is invalid.");

const publicPhoneInput = z
  .string()
  .trim()
  .max(30, "Phone is too long")
  .superRefine((value, ctx) => {
    if (value === "") {
      return;
    }
    const normalized = normalizePhone(value);
    if (!normalized || !isValidNormalizedPhone(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter a valid phone number.",
      });
    }
  })
  .transform((value) => (value === "" ? null : normalizePhone(value)));

export const joinPublicQueueFieldsSchema = z.object({
  name: customerNameSchema,
  phone: z.string(),
  partySize: partySizeSchema,
});

export type JoinPublicQueueFormValues = z.infer<
  typeof joinPublicQueueFieldsSchema
>;

export function joinPublicQueueSchema(options: {
  requirePhone: boolean;
  maxPartySize?: number;
}) {
  const maxPartySize = options.maxPartySize ?? MAX_PARTY_SIZE;
  return z
    .object({
      name: customerNameSchema,
      phone: publicPhoneInput,
      partySize: partySizeSchema.refine(
        (value) => value <= maxPartySize,
        "Party size is too large",
      ),
    })
    .superRefine((value, ctx) => {
      if (options.requirePhone && !value.phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone number is required.",
          path: ["phone"],
        });
      }
    });
}

export type JoinPublicQueueInput = z.infer<
  ReturnType<typeof joinPublicQueueSchema>
>;

export function joinPublicQueueFormSchema(options: {
  requirePhone: boolean;
  maxPartySize?: number;
}) {
  const maxPartySize = options.maxPartySize ?? MAX_PARTY_SIZE;
  return z.object({
    name: customerNameSchema,
    phone: z
      .string()
      .trim()
      .max(30, "Phone is too long")
      .superRefine((value, ctx) => {
        if (value === "") {
          if (options.requirePhone) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Phone number is required.",
            });
          }
          return;
        }
        const normalized = normalizePhone(value);
        if (!normalized || !isValidNormalizedPhone(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter a valid phone number.",
          });
        }
      }),
    partySize: partySizeSchema.refine(
      (value) => value <= maxPartySize,
      "Party size is too large",
    ),
  });
}

export function toJoinPublicQueueFormValues(): JoinPublicQueueFormValues {
  return {
    name: "",
    phone: "",
    partySize: 2,
  };
}

export const searchPublicQueueCustomersSchema = z.object({
  query: z
    .string()
    .trim()
    .min(8, "Enter your full phone number to look yourself up.")
    .max(30, "Search is too long"),
});

export type SearchPublicQueueCustomersInput = z.infer<
  typeof searchPublicQueueCustomersSchema
>;

export type PublicQueueCustomerSearchResult = {
  name: string;
  phone: string | null;
};
