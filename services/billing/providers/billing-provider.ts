import type { BillingCycle } from "@/lib/billing/types";

export type ProviderCustomerInput = {
  name: string;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, string>;
};

export type ProviderCustomer = {
  id: string;
};

export type ProviderPlanInput = {
  code: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
};

export type ProviderPlan = {
  id: string;
};

export type ProviderSubscriptionInput = {
  planId: string;
  customerId: string;
  totalCount: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
};

export type ProviderSubscription = {
  id: string;
  status: string;
  currentStart: number | null;
  currentEnd: number | null;
  chargeAt: number | null;
  notes?: Record<string, string>;
};

export type ProviderCancelInput = {
  subscriptionId: string;
  cancelAtCycleEnd: boolean;
};

export type ProviderVerifyPaymentInput = {
  orderId?: string;
  paymentId: string;
  subscriptionId: string;
  signature: string;
};

export type ProviderWebhookVerification = {
  rawBody: string;
  signature: string | null;
};

/**
 * Payment-provider abstraction. Keep SDK/API specifics inside implementations.
 */
export interface BillingProvider {
  readonly name: "RAZORPAY";

  isConfigured(): boolean;

  getPublicKey(): string | null;

  createCustomer(input: ProviderCustomerInput): Promise<ProviderCustomer>;

  ensurePlan(input: ProviderPlanInput): Promise<ProviderPlan>;

  createSubscription(
    input: ProviderSubscriptionInput,
  ): Promise<ProviderSubscription>;

  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  cancelSubscription(input: ProviderCancelInput): Promise<ProviderSubscription>;

  /** Undo a scheduled cancel-at-period-end when the provider supports it. */
  resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscription>;

  verifyCheckoutSignature(input: ProviderVerifyPaymentInput): boolean;

  verifyWebhook(input: ProviderWebhookVerification): boolean;
}
