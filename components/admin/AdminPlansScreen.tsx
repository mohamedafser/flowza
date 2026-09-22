"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/api/admin-client";
import { scheduleAdminFetchStart } from "@/lib/admin/schedule-fetch";
import { ADMIN_PLANS_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import type { Tables } from "@/types/database";
import { toast } from "sonner";

const FEATURE_KEYS = [
  "basic_queue",
  "basic_customers",
  "basic_dashboard",
  "reservations",
  "notifications",
  "tv_displays",
  "analytics",
  "advanced_analytics",
  "exports",
  "multiple_displays",
] as const;

type PlanRow = Tables<"plans">;

type PlanFormState = {
  code: string;
  name: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  currency: string;
  sortOrder: string;
  isActive: boolean;
  features: Record<string, boolean>;
  limits: {
    max_branches: string;
    max_staff: string;
    max_tables: string;
    max_queue_entries_per_month: string;
    max_reservations_per_month: string;
    max_displays: string;
  };
};

function defaultForm(): PlanFormState {
  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    features[key] = key.startsWith("basic_");
  }
  return {
    code: "",
    name: "",
    description: "",
    monthlyPrice: "0",
    yearlyPrice: "0",
    currency: "INR",
    sortOrder: "0",
    isActive: true,
    features,
    limits: {
      max_branches: "1",
      max_staff: "2",
      max_tables: "2",
      max_queue_entries_per_month: "100",
      max_reservations_per_month: "0",
      max_displays: "0",
    },
  };
}

function parseFeatures(value: unknown): Record<string, boolean> {
  const base = defaultForm().features;
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const row = value as Record<string, unknown>;
  for (const key of FEATURE_KEYS) {
    base[key] = Boolean(row[key]);
  }
  return base;
}

function parseLimits(value: unknown): PlanFormState["limits"] {
  const defaults = defaultForm().limits;
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const row = value as Record<string, unknown>;
  const num = (key: keyof PlanFormState["limits"]) => {
    const v = row[key];
    return typeof v === "number" && Number.isFinite(v) ? String(v) : defaults[key];
  };
  return {
    max_branches: num("max_branches"),
    max_staff: num("max_staff"),
    max_tables: num("max_tables"),
    max_queue_entries_per_month: num("max_queue_entries_per_month"),
    max_reservations_per_month: num("max_reservations_per_month"),
    max_displays: num("max_displays"),
  };
}

function planToForm(plan: PlanRow): PlanFormState {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    monthlyPrice: String(plan.monthly_price),
    yearlyPrice: String(plan.yearly_price),
    currency: plan.currency,
    sortOrder: String(plan.sort_order),
    isActive: plan.is_active,
    features: parseFeatures(plan.features),
    limits: parseLimits(plan.limits),
  };
}

function buildPayload(form: PlanFormState) {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    monthlyPrice: Number(form.monthlyPrice),
    yearlyPrice: Number(form.yearlyPrice),
    currency: form.currency.trim().toUpperCase(),
    sortOrder: Number(form.sortOrder),
    isActive: form.isActive,
    features: form.features,
    limits: {
      max_branches: Number(form.limits.max_branches),
      max_staff: Number(form.limits.max_staff),
      max_tables: Number(form.limits.max_tables),
      max_queue_entries_per_month: Number(form.limits.max_queue_entries_per_month),
      max_reservations_per_month: Number(form.limits.max_reservations_per_month),
      max_displays: Number(form.limits.max_displays),
    },
  };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function AdminPlansScreen() {
  const requestId = useRef(0);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [toggleConfirm, setToggleConfirm] = useState<{
    id: string;
    code: string;
    isActive: boolean;
  } | null>(null);
  const [toggling, setToggling] = useState(false);

  const loadPlans = useCallback(() => {
    const id = ++requestId.current;
    const cancelStart = scheduleAdminFetchStart(() => {
      if (id !== requestId.current) return;
      setLoading(true);
      setError(null);
    });
    void adminFetch<PlanRow[]>("/api/admin/plans").then((response) => {
      if (id !== requestId.current) return;
      setLoading(false);
      if (!response.ok || !response.data) {
        setError(response.message ?? "Unable to load plans.");
        setPlans([]);
        return;
      }
      setPlans(response.data);
    });
    return cancelStart;
  }, []);

  useEffect(() => {
    return loadPlans();
  }, [loadPlans]);

  function openCreate() {
    setEditingId(null);
    setForm(defaultForm());
    setEditorOpen(true);
  }

  function openEdit(plan: PlanRow) {
    setEditingId(plan.id);
    setForm(planToForm(plan));
    setEditorOpen(true);
  }

  async function savePlan() {
    setSaving(true);
    const payload = buildPayload(form);
    const response = editingId
      ? await adminFetch(`/api/admin/plans/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      : await adminFetch("/api/admin/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    setSaving(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to save plan.");
      return;
    }
    toast.success(editingId ? "Plan updated." : "Plan created.");
    setEditorOpen(false);
    loadPlans();
  }

  async function applyToggle() {
    if (!toggleConfirm) return;
    setToggling(true);
    const response = await adminFetch(`/api/admin/plans/${toggleConfirm.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: toggleConfirm.isActive }),
    });
    setToggling(false);
    if (!response.ok) {
      toast.error(response.message ?? "Unable to update plan.");
      return;
    }
    toast.success(
      toggleConfirm.isActive ? "Plan activated." : "Plan deactivated.",
    );
    setToggleConfirm(null);
    setPlans((prev) =>
      prev.map((p) =>
        p.id === toggleConfirm.id
          ? { ...p, is_active: toggleConfirm.isActive }
          : p,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Manage subscription plans, pricing, limits, and feature flags."
        breadcrumbs={ADMIN_PLANS_BREADCRUMBS}
        actions={<Button onClick={openCreate}>New plan</Button>}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Unable to load plans" message={error} />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create a plan to offer subscriptions."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Monthly</th>
                <th className="px-3 py-2 font-medium">Yearly</th>
                <th className="px-3 py-2 font-medium">Sort</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-border border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-muted-foreground text-xs">{plan.code}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoney(Number(plan.monthly_price), plan.currency)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoney(Number(plan.yearly_price), plan.currency)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{plan.sort_order}</td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge
                      status={plan.is_active ? "ACTIVE" : "INACTIVE"}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="xs" variant="outline" onClick={() => openEdit(plan)}>
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant={plan.is_active ? "destructive" : "default"}
                        onClick={() =>
                          setToggleConfirm({
                            id: plan.id,
                            code: plan.code,
                            isActive: !plan.is_active,
                          })
                        }
                      >
                        {plan.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit plan" : "New plan"}</DialogTitle>
            <DialogDescription>
              Plan codes must be UPPER_SNAKE_CASE. Prices are in the plan currency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="plan-code">Code</Label>
              <Input
                id="plan-code"
                value={form.code}
                disabled={Boolean(editingId)}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="plan-desc">Description</Label>
              <Input
                id="plan-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-monthly">Monthly price</Label>
              <Input
                id="plan-monthly"
                type="number"
                min={0}
                value={form.monthlyPrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-yearly">Yearly price</Label>
              <Input
                id="plan-yearly"
                type="number"
                min={0}
                value={form.yearlyPrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, yearlyPrice: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-currency">Currency</Label>
              <Input
                id="plan-currency"
                maxLength={3}
                value={form.currency}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    currency: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-sort">Sort order</Label>
              <Input
                id="plan-sort"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="plan-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label htmlFor="plan-active">Active on checkout</Label>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Limits</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(form.limits) as Array<keyof PlanFormState["limits"]>).map(
                (key) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`limit-${key}`}>{key.replace(/_/g, " ")}</Label>
                    <Input
                      id={`limit-${key}`}
                      type="number"
                      min={0}
                      value={form.limits[key]}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          limits: { ...prev.limits, [key]: e.target.value },
                        }))
                      }
                    />
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Features</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`feat-${key}`}
                    checked={form.features[key] ?? false}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({
                        ...prev,
                        features: { ...prev.features, [key]: checked },
                      }))
                    }
                  />
                  <Label htmlFor={`feat-${key}`}>{key.replace(/_/g, " ")}</Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button disabled={saving} onClick={() => void savePlan()}>
              {editingId ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toggleConfirm)}
        onOpenChange={(open) => {
          if (!open) setToggleConfirm(null);
        }}
        title={
          toggleConfirm?.isActive ? "Activate plan?" : "Deactivate plan?"
        }
        description={
          toggleConfirm?.isActive
            ? `${toggleConfirm.code} will be available for new subscriptions.`
            : `${toggleConfirm?.code ?? "This plan"} will be hidden from checkout.`
        }
        confirmLabel={toggleConfirm?.isActive ? "Activate" : "Deactivate"}
        destructive={!toggleConfirm?.isActive}
        loading={toggling}
        onConfirm={() => void applyToggle()}
      />
    </div>
  );
}
