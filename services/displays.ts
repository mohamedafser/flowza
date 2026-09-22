import { cache } from "react";
import {
  AuthorizationError,
  requirePermission,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { safeDatabaseMessage } from "@/lib/errors/action";
import type { ActionErrorCode } from "@/lib/errors/action";
import {
  publicDisplayRpcSchema,
  toPublicDisplayData,
} from "@/lib/public-display/dto";
import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import { isValidPublicDisplayToken } from "@/lib/public-display/paths";
import type { PublicDisplayResponse } from "@/lib/public-display/types";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDisplaySettings,
  type CreateDisplayInput,
  type DisplaySettings,
  type SetDisplayStatusInput,
  type UpdateDisplayInput,
} from "@/lib/validations/display";
import { writeAuditLog } from "@/services/audit";
import type { Json, Tables, TablesUpdate } from "@/types/database";

export type DisplayRecord = {
  id: string;
  branch_id: string;
  queue_id: string;
  name: string;
  display_code: string;
  public_token: string;
  mode: "QUEUE" | "TABLES" | "COMBINED";
  is_active: boolean;
  settings: DisplaySettings;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DisplayListItem = DisplayRecord & {
  branch_name: string;
  queue_name: string;
  restaurant_id: string;
};

export type DisplayMutationCode = ActionErrorCode;

export type DisplayMutationResult =
  | { ok: true; display: DisplayRecord }
  | { ok: false; message: string; code: DisplayMutationCode };

export type PublicDisplayResult =
  | { ok: true; data: PublicDisplayResponse }
  | { ok: false; code: ActionErrorCode; message: string };

type DisplayRow = Tables<"displays">;

type DisplayJoinRow = DisplayRow & {
  branch:
    | { id: string; name: string; restaurant_id: string }
    | { id: string; name: string; restaurant_id: string }[]
    | null;
  queue: { id: string; name: string } | { id: string; name: string }[] | null;
};

const DISPLAY_SELECT =
  "*, branch:branches!inner(id, name, restaurant_id), queue:queues!inner(id, name)";

function asDisplay(row: DisplayRow): DisplayRecord {
  return {
    id: row.id,
    branch_id: row.branch_id,
    queue_id: row.queue_id,
    name: row.name,
    display_code: row.display_code,
    public_token: row.public_token,
    mode: row.mode,
    is_active: row.is_active,
    settings: normalizeDisplaySettings(row.settings),
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function firstJoin<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asListItem(row: DisplayJoinRow): DisplayListItem | null {
  const branch = firstJoin(row.branch);
  const queue = firstJoin(row.queue);
  if (!branch || !queue) return null;
  return {
    ...asDisplay(row),
    branch_name: branch.name,
    queue_name: queue.name,
    restaurant_id: branch.restaurant_id,
  };
}

function settingsToJson(settings: DisplaySettings): Json {
  return {
    nextTokenCount: settings.nextTokenCount,
    showRestaurantLogo: settings.showRestaurantLogo,
    showBranchName: settings.showBranchName,
    showQueueName: settings.showQueueName,
    theme: settings.theme,
    preferFullscreen: settings.preferFullscreen,
  };
}

async function resolveBranchRestaurant(
  branchId: string,
): Promise<{ restaurantId: string; isActive: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("restaurant_id, is_active")
    .eq("id", branchId)
    .maybeSingle();
  if (!data) return null;
  return { restaurantId: data.restaurant_id, isActive: data.is_active };
}

async function assertQueueOnBranch(
  queueId: string,
  branchId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("queues")
    .select("id, branch_id")
    .eq("id", queueId)
    .maybeSingle();
  return Boolean(data && data.branch_id === branchId);
}

async function loadDisplayRow(
  displayId: string,
): Promise<DisplayListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("displays")
    .select(DISPLAY_SELECT)
    .eq("id", displayId)
    .maybeSingle();

  if (error || !data) return null;
  return asListItem(data as DisplayJoinRow);
}

export async function getDisplays(
  restaurantId: string,
): Promise<DisplayListItem[]> {
  await requirePermission(restaurantId, "displays.view");

  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const branchIds = (branches ?? []).map((branch) => branch.id);
  if (branchIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("displays")
    .select(DISPLAY_SELECT)
    .in("branch_id", branchIds)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => asListItem(row as DisplayJoinRow))
    .filter((row): row is DisplayListItem => row !== null);
}

export async function getDisplay(
  displayId: string,
): Promise<DisplayListItem | null> {
  await requireVerifiedAuth();
  const row = await loadDisplayRow(displayId);
  if (!row) return null;
  await requirePermission(row.restaurant_id, "displays.view");
  return row;
}

export async function createDisplay(
  input: CreateDisplayInput,
): Promise<DisplayMutationResult> {
  await requirePermission(input.restaurantId, "displays.manage");

  try {
    const { assertFeatureAccess, assertUsageLimit } = await import(
      "@/services/billing/entitlement.service"
    );
    await assertFeatureAccess(input.restaurantId, "tv_displays");
    await assertUsageLimit(input.restaurantId, "displays");
  } catch (error) {
    const { isSubscriptionLimitError } = await import("@/lib/billing/errors");
    const { SubscriptionFeatureError } = await import("@/lib/billing/errors");
    if (isSubscriptionLimitError(error)) {
      return {
        ok: false,
        code: "SUBSCRIPTION_LIMIT_REACHED",
        message: error.message,
      };
    }
    if (error instanceof SubscriptionFeatureError) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: error.message,
      };
    }
    throw error;
  }

  const branch = await resolveBranchRestaurant(input.branchId);
  if (!branch || branch.restaurantId !== input.restaurantId) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Select a valid branch for this restaurant.",
    };
  }

  if (!(await assertQueueOnBranch(input.queueId, input.branchId))) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Select a queue that belongs to the chosen branch.",
    };
  }

  const settings = normalizeDisplaySettings(input.settings);
  const supabase = await createClient();

  const [{ data: publicToken }, { data: displayCode }] = await Promise.all([
    supabase.rpc("generate_display_public_token"),
    supabase.rpc("generate_display_code"),
  ]);

  if (!publicToken || !displayCode) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create display. Please try again.",
    };
  }

  const { data, error } = await supabase
    .from("displays")
    .insert({
      branch_id: input.branchId,
      queue_id: input.queueId,
      name: input.name.trim(),
      display_code: displayCode,
      public_token: publicToken,
      mode: "QUEUE",
      is_active: input.isActive,
      settings: settingsToJson(settings),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (
      /displays_branch_name_unique|duplicate key/i.test(error?.message ?? "")
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "A display with this name already exists for the branch.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create display. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: input.restaurantId,
    userId: auth.user.id,
    action: "display.created",
    entityType: "display",
    entityId: data.id,
    metadata: {
      name: data.name,
      branch_id: data.branch_id,
      queue_id: data.queue_id,
      is_active: data.is_active,
    },
  });

  return { ok: true, display: asDisplay(data) };
}

export async function updateDisplay(
  input: UpdateDisplayInput,
): Promise<DisplayMutationResult> {
  const existing = await loadDisplayRow(input.displayId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "Display not found." };
  }

  await requirePermission(existing.restaurant_id, "displays.manage");

  const nextBranchId = input.branchId ?? existing.branch_id;
  const nextQueueId = input.queueId ?? existing.queue_id;

  const branch = await resolveBranchRestaurant(nextBranchId);
  if (!branch || branch.restaurantId !== existing.restaurant_id) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Select a valid branch for this restaurant.",
    };
  }

  if (!(await assertQueueOnBranch(nextQueueId, nextBranchId))) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Select a queue that belongs to the chosen branch.",
    };
  }

  const patch: TablesUpdate<"displays"> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.branchId !== undefined) patch.branch_id = input.branchId;
  if (input.queueId !== undefined) patch.queue_id = input.queueId;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.settings !== undefined) {
    patch.settings = settingsToJson(
      normalizeDisplaySettings({
        ...existing.settings,
        ...input.settings,
      }),
    );
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, display: existing };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("displays")
    .update(patch)
    .eq("id", input.displayId)
    .select("*")
    .single();

  if (error || !data) {
    if (
      /displays_branch_name_unique|duplicate key/i.test(error?.message ?? "")
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "A display with this name already exists for the branch.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update display. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: auth.user.id,
    action: "display.updated",
    entityType: "display",
    entityId: data.id,
    metadata: {
      name: data.name,
      branch_id: data.branch_id,
      queue_id: data.queue_id,
      is_active: data.is_active,
    },
  });

  return { ok: true, display: asDisplay(data) };
}

export async function activateDisplay(
  displayId: string,
): Promise<DisplayMutationResult> {
  return setDisplayStatus({ displayId, isActive: true });
}

export async function deactivateDisplay(
  displayId: string,
): Promise<DisplayMutationResult> {
  return setDisplayStatus({ displayId, isActive: false });
}

export async function setDisplayStatus(
  input: SetDisplayStatusInput,
): Promise<DisplayMutationResult> {
  const existing = await loadDisplayRow(input.displayId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "Display not found." };
  }

  await requirePermission(existing.restaurant_id, "displays.manage");

  if (existing.is_active === input.isActive) {
    return { ok: true, display: existing };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("displays")
    .update({ is_active: input.isActive })
    .eq("id", input.displayId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update display status. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: auth.user.id,
    action: input.isActive ? "display.activated" : "display.deactivated",
    entityType: "display",
    entityId: data.id,
    metadata: {
      name: data.name,
      is_active: data.is_active,
    },
  });

  return { ok: true, display: asDisplay(data) };
}

export async function deleteDisplay(
  displayId: string,
): Promise<DisplayMutationResult> {
  const existing = await loadDisplayRow(displayId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "Display not found." };
  }

  await requirePermission(existing.restaurant_id, "displays.manage");

  // Soft-delete by deactivating to avoid breaking open TV sessions abruptly
  // when staff intended a safe remove. Hard delete only if already inactive.
  if (existing.is_active) {
    return deactivateDisplay(displayId);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("displays")
    .delete()
    .eq("id", displayId);

  if (error) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to delete display. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: auth.user.id,
    action: "display.deleted",
    entityType: "display",
    entityId: displayId,
    metadata: {
      name: existing.name,
      branch_id: existing.branch_id,
      queue_id: existing.queue_id,
    },
  });

  return { ok: true, display: { ...existing, is_active: false } };
}

export const getPublicDisplay = cache(
  async (publicToken: string): Promise<PublicDisplayResult> => {
    if (!isValidPublicDisplayToken(publicToken)) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_DISPLAY_MESSAGES.notFound,
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_display", {
      p_public_token: publicToken,
    });

    if (error) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: safeDatabaseMessage(error, PUBLIC_DISPLAY_MESSAGES.unexpected),
      };
    }

    if (data == null) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_DISPLAY_MESSAGES.notFound,
      };
    }

    const parsed = publicDisplayRpcSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: PUBLIC_DISPLAY_MESSAGES.unexpected,
      };
    }

    return { ok: true, data: toPublicDisplayData(parsed.data) };
  },
);

export function canViewDisplays(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, "displays.view");
}

export function canManageDisplays(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, "displays.manage");
}

export type DisplayQueueOption = {
  id: string;
  branch_id: string;
  name: string;
  status: string;
};

export async function listQueuesForDisplayForm(
  restaurantId: string,
): Promise<DisplayQueueOption[]> {
  await requirePermission(restaurantId, "displays.view");

  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const branchIds = (branches ?? []).map((branch) => branch.id);
  if (branchIds.length === 0) return [];

  const { data, error } = await supabase
    .from("queues")
    .select("id, branch_id, name, status")
    .in("branch_id", branchIds)
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data;
}

export function assertCanManageDisplays(
  role: Parameters<typeof hasPermission>[0],
): void {
  if (!canManageDisplays(role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to manage displays.",
    );
  }
}
