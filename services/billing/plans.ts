import {
  parsePlanFeatures,
  parsePlanLimits,
  type PlanRecord,
} from "@/lib/billing/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/database";

function asPlan(row: Tables<"plans">): PlanRecord {
  return {
    ...row,
    code: row.code,
    description: row.description,
    monthly_price: Number(row.monthly_price),
    yearly_price: Number(row.yearly_price),
    price: Number(row.price),
    limits: parsePlanLimits(row.limits),
    features: parsePlanFeatures(row.features),
  };
}

export async function listActivePlans(): Promise<PlanRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(asPlan);
}

export async function getPlanByCode(
  code: string,
): Promise<PlanRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return asPlan(data);
}

export async function getPlanById(planId: string): Promise<PlanRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return asPlan(data);
}

/** Service-role plan lookup for webhooks / system jobs. */
export async function getPlanByCodeAdmin(
  code: string,
): Promise<PlanRecord | null> {
  const admin = createServiceRoleClient();
  if (!admin) return getPlanByCode(code);

  const { data, error } = await admin
    .from("plans")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return asPlan(data);
}

export function planPrice(
  plan: PlanRecord,
  billingCycle: "MONTHLY" | "YEARLY",
): number {
  return billingCycle === "YEARLY" ? plan.yearly_price : plan.monthly_price;
}

export function isFreePlan(plan: PlanRecord | null | undefined): boolean {
  if (!plan) return false;
  return (
    plan.code === "FREE" ||
    (plan.monthly_price <= 0 && plan.yearly_price <= 0)
  );
}

export function serializePlanFeatures(features: PlanRecord["features"]): Json {
  return { ...(features as Record<string, boolean>) };
}

export function serializePlanLimits(limits: PlanRecord["limits"]): Json {
  return { ...(limits as Record<string, number>) };
}
