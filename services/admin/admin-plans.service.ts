import type { Json, Tables } from "@/types/database";
import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import type { adminPlanUpsertSchema } from "@/lib/validations/admin";
import { requireAdminClient } from "@/services/admin/admin-client";
import { writePlatformAuditLog } from "@/services/audit";
import type { z } from "zod";

export type AdminPlanInput = z.infer<typeof adminPlanUpsertSchema>;

export async function listAdminPlans(): Promise<Tables<"plans">[]> {
  await requirePlatformPermission("platform.plans.view");
  const admin = requireAdminClient();
  const { data, error } = await admin
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to list plans.");
  }
  return data ?? [];
}

export async function getAdminPlan(
  planId: string,
): Promise<Tables<"plans"> | null> {
  await requirePlatformPermission("platform.plans.view");
  const admin = requireAdminClient();
  const { data } = await admin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  return data;
}

export async function createAdminPlan(
  input: AdminPlanInput,
): Promise<Tables<"plans">> {
  const context = await requirePlatformPermission("platform.plans.manage");
  const admin = requireAdminClient();

  const { data, error } = await admin
    .from("plans")
    .insert({
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      price: input.monthlyPrice,
      monthly_price: input.monthlyPrice,
      yearly_price: input.yearlyPrice,
      currency: input.currency,
      billing_cycle: "MONTHLY",
      features: input.features as Json,
      limits: input.limits as unknown as Json,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (error?.message?.includes("duplicate") || error?.code === "23505") {
      throw new Error("A plan with this code already exists.");
    }
    throw new Error("Unable to create plan.");
  }

  await writePlatformAuditLog({
    userId: context.user.id,
    action: "PLAN_CREATED",
    entityType: "plan",
    entityId: data.id,
    metadata: { code: data.code },
  });

  return data;
}

export async function updateAdminPlan(
  planId: string,
  input: AdminPlanInput,
): Promise<Tables<"plans">> {
  const context = await requirePlatformPermission("platform.plans.manage");
  const admin = requireAdminClient();

  const { data: existing } = await admin
    .from("plans")
    .select("id, code")
    .eq("id", planId)
    .maybeSingle();

  if (!existing) {
    throw new Error("Plan not found.");
  }

  const { data, error } = await admin
    .from("plans")
    .update({
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      price: input.monthlyPrice,
      monthly_price: input.monthlyPrice,
      yearly_price: input.yearlyPrice,
      currency: input.currency,
      features: input.features as Json,
      limits: input.limits as unknown as Json,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    })
    .eq("id", planId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to update plan.");
  }

  await writePlatformAuditLog({
    userId: context.user.id,
    action: "PLAN_UPDATED",
    entityType: "plan",
    entityId: data.id,
    metadata: { code: data.code },
  });

  return data;
}

export async function setAdminPlanActive(
  planId: string,
  isActive: boolean,
): Promise<Tables<"plans">> {
  const context = await requirePlatformPermission("platform.plans.manage");
  const admin = requireAdminClient();

  if (!isActive) {
    const { count } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId)
      .in("status", ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED"]);

    // Soft-deactivate is always allowed; referenced plans remain for history.
    void count;
  }

  const { data, error } = await admin
    .from("plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to update plan status.");
  }

  await writePlatformAuditLog({
    userId: context.user.id,
    action: isActive ? "PLAN_ACTIVATED" : "PLAN_DEACTIVATED",
    entityType: "plan",
    entityId: data.id,
    metadata: { code: data.code, isActive },
  });

  return data;
}
