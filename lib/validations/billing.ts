import { z } from "zod";

export const checkoutSchema = z.object({
  restaurantId: z.string().uuid(),
  planCode: z.string().min(1).max(64),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

export const verifyCheckoutSchema = z.object({
  restaurantId: z.string().uuid(),
  planCode: z.string().min(1).max(64),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  razorpayPaymentId: z.string().min(1).max(128),
  razorpaySubscriptionId: z.string().min(1).max(128),
  razorpaySignature: z.string().min(1).max(256),
});

export const billingRestaurantSchema = z.object({
  restaurantId: z.string().uuid(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type VerifyCheckoutParsed = z.infer<typeof verifyCheckoutSchema>;
