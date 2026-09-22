import type { BillingProvider } from "@/services/billing/providers/billing-provider";
import { getRazorpayProvider } from "@/services/billing/providers/razorpay.provider";

export function getBillingProvider(): BillingProvider {
  return getRazorpayProvider();
}

export type { BillingProvider } from "@/services/billing/providers/billing-provider";
