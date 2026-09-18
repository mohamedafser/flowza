import { cache } from "react";
import {
  AuthorizationError,
  requirePermission,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { safeDatabaseMessage } from "@/lib/errors/action";
import type { ActionErrorCode } from "@/lib/errors/action";
import { parsePublicQRRpc, toPublicQRData } from "@/lib/public-qr/dto";
import { PUBLIC_QR_MESSAGES } from "@/lib/public-qr/messages";
import { isValidPublicQRToken } from "@/lib/public-qr/paths";
import type { PublicQRResponse } from "@/lib/public-qr/types";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeQRCodeSettings,
  type CreateQRCodeInput,
  type QRCodeSettings,
  type SetQRCodeStatusInput,
  type UpdateQRCodeInput,
} from "@/lib/validations/qr-code";
import { writeAuditLog } from "@/services/audit";
import type { Json, Tables, TablesUpdate } from "@/types/database";

export type QRCodeRecord = {
  id: string;
  restaurant_id: string;
  branch_id: string;
  queue_id: string;
  name: string;
  type: "QUEUE_JOIN";
  public_token: string;
  is_active: boolean;
  settings: QRCodeSettings;
  created_at: string;
  updated_at: string;
};

export type QRCodeListItem = QRCodeRecord & {
  branch_name: string;
  branch_slug: string;
  queue_name: string;
  restaurant_name: string;
  restaurant_slug: string;
};

export type QRCodeMutationCode = ActionErrorCode;

export type QRCodeMutationResult =
  | { ok: true; qrCode: QRCodeRecord }
  | { ok: false; message: string; code: QRCodeMutationCode };

export type PublicQRResult =
  | { ok: true; data: PublicQRResponse }
  | { ok: false; code: ActionErrorCode; message: string };

type QRCodeRow = Tables<"qr_codes">;

type QRCodeJoinRow = QRCodeRow & {
  branch:
    | { id: string; name: string; slug: string; restaurant_id: string }
    | { id: string; name: string; slug: string; restaurant_id: string }[]
    | null;
  queue: { id: string; name: string } | { id: string; name: string }[] | null;
  restaurant:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};

const QR_SELECT =
  "*, branch:branches!inner(id, name, slug, restaurant_id), queue:queues!inner(id, name), restaurant:restaurants!inner(id, name, slug)";

function asQRCode(row: QRCodeRow): QRCodeRecord {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    branch_id: row.branch_id,
    queue_id: row.queue_id,
    name: row.name,
    type: row.type,
    public_token: row.public_token,
    is_active: row.is_active,
    settings: normalizeQRCodeSettings(row.settings),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function firstJoin<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asListItem(row: QRCodeJoinRow): QRCodeListItem | null {
  const branch = firstJoin(row.branch);
  const queue = firstJoin(row.queue);
  const restaurant = firstJoin(row.restaurant);
  if (!branch || !queue || !restaurant) return null;
  return {
    ...asQRCode(row),
    branch_name: branch.name,
    branch_slug: branch.slug,
    queue_name: queue.name,
    restaurant_name: restaurant.name,
    restaurant_slug: restaurant.slug,
  };
}

function settingsToJson(settings: QRCodeSettings): Json {
  return {
    showRestaurantName: settings.showRestaurantName,
    showBranchName: settings.showBranchName,
    showQueueName: settings.showQueueName,
    ...(settings.caption ? { caption: settings.caption } : {}),
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

async function loadQRCodeRow(qrCodeId: string): Promise<QRCodeListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_codes")
    .select(QR_SELECT)
    .eq("id", qrCodeId)
    .maybeSingle();

  if (error || !data) return null;
  return asListItem(data as QRCodeJoinRow);
}

export async function getQRCodes(
  restaurantId: string,
): Promise<QRCodeListItem[]> {
  await requirePermission(restaurantId, "qr_codes.view");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_codes")
    .select(QR_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => asListItem(row as QRCodeJoinRow))
    .filter((row): row is QRCodeListItem => row !== null);
}

export async function getQRCode(
  qrCodeId: string,
): Promise<QRCodeListItem | null> {
  await requireVerifiedAuth();
  const row = await loadQRCodeRow(qrCodeId);
  if (!row) return null;
  await requirePermission(row.restaurant_id, "qr_codes.view");
  return row;
}

export async function createQRCode(
  input: CreateQRCodeInput,
): Promise<QRCodeMutationResult> {
  await requirePermission(input.restaurantId, "qr_codes.manage");

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

  const settings = normalizeQRCodeSettings(input.settings);
  const supabase = await createClient();

  const { data: publicToken, error: tokenError } = await supabase.rpc(
    "generate_qr_public_token",
  );

  if (tokenError || !publicToken) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create QR code. Please try again.",
    };
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .insert({
      restaurant_id: input.restaurantId,
      branch_id: input.branchId,
      queue_id: input.queueId,
      name: input.name.trim(),
      type: "QUEUE_JOIN",
      public_token: publicToken,
      is_active: input.isActive,
      settings: settingsToJson(settings),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (
      /qr_codes_branch_name_unique|duplicate key/i.test(error?.message ?? "")
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "A QR code with this name already exists for the branch.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create QR code. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: input.restaurantId,
    userId: auth.user.id,
    action: "qr_code.created",
    entityType: "qr_code",
    entityId: data.id,
    metadata: {
      name: data.name,
      branch_id: data.branch_id,
      queue_id: data.queue_id,
      type: data.type,
      is_active: data.is_active,
    },
  });

  return { ok: true, qrCode: asQRCode(data) };
}

export async function updateQRCode(
  input: UpdateQRCodeInput,
): Promise<QRCodeMutationResult> {
  const existing = await loadQRCodeRow(input.qrCodeId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "QR code not found." };
  }

  await requirePermission(existing.restaurant_id, "qr_codes.manage");

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

  const patch: TablesUpdate<"qr_codes"> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.branchId !== undefined) patch.branch_id = input.branchId;
  if (input.queueId !== undefined) patch.queue_id = input.queueId;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.settings !== undefined) {
    patch.settings = settingsToJson(
      normalizeQRCodeSettings({
        ...existing.settings,
        ...input.settings,
      }),
    );
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, qrCode: existing };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_codes")
    .update(patch)
    .eq("id", input.qrCodeId)
    .select("*")
    .single();

  if (error || !data) {
    if (
      /qr_codes_branch_name_unique|duplicate key/i.test(error?.message ?? "")
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "A QR code with this name already exists for the branch.",
      };
    }
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update QR code. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: auth.user.id,
    action: "qr_code.updated",
    entityType: "qr_code",
    entityId: data.id,
    metadata: {
      name: data.name,
      branch_id: data.branch_id,
      queue_id: data.queue_id,
      is_active: data.is_active,
      destination_changed:
        data.branch_id !== existing.branch_id ||
        data.queue_id !== existing.queue_id,
    },
  });

  return { ok: true, qrCode: asQRCode(data) };
}

export async function activateQRCode(
  qrCodeId: string,
): Promise<QRCodeMutationResult> {
  return setQRCodeStatus({ qrCodeId, isActive: true });
}

export async function deactivateQRCode(
  qrCodeId: string,
): Promise<QRCodeMutationResult> {
  return setQRCodeStatus({ qrCodeId, isActive: false });
}

export async function setQRCodeStatus(
  input: SetQRCodeStatusInput,
): Promise<QRCodeMutationResult> {
  const existing = await loadQRCodeRow(input.qrCodeId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "QR code not found." };
  }

  await requirePermission(existing.restaurant_id, "qr_codes.manage");

  if (existing.is_active === input.isActive) {
    return { ok: true, qrCode: existing };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_codes")
    .update({ is_active: input.isActive })
    .eq("id", input.qrCodeId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update QR code status. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: auth.user.id,
    action: input.isActive ? "qr_code.activated" : "qr_code.deactivated",
    entityType: "qr_code",
    entityId: data.id,
    metadata: {
      name: data.name,
      is_active: data.is_active,
    },
  });

  return { ok: true, qrCode: asQRCode(data) };
}

export async function regenerateQRCodeToken(
  qrCodeId: string,
): Promise<QRCodeMutationResult> {
  const existing = await loadQRCodeRow(qrCodeId);
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", message: "QR code not found." };
  }

  await requirePermission(existing.restaurant_id, "qr_codes.manage");

  const supabase = await createClient();
  const { data: publicToken, error: tokenError } = await supabase.rpc(
    "generate_qr_public_token",
  );

  if (tokenError || !publicToken) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to regenerate QR token. Please try again.",
    };
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .update({ public_token: publicToken })
    .eq("id", qrCodeId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to regenerate QR token. Please try again.",
      ),
    };
  }

  const auth = await requireVerifiedAuth();
  await writeAuditLog({
    restaurantId: existing.restaurant_id,
    userId: auth.user.id,
    action: "qr_code.token_regenerated",
    entityType: "qr_code",
    entityId: data.id,
    metadata: {
      name: data.name,
      branch_id: data.branch_id,
      queue_id: data.queue_id,
    },
  });

  return { ok: true, qrCode: asQRCode(data) };
}

export const getPublicQRCode = cache(
  async (publicToken: string): Promise<PublicQRResult> => {
    if (!isValidPublicQRToken(publicToken)) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QR_MESSAGES.notFound,
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_qr_code", {
      p_public_token: publicToken,
    });

    if (error) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: safeDatabaseMessage(error, PUBLIC_QR_MESSAGES.unexpected),
      };
    }

    if (data == null) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: PUBLIC_QR_MESSAGES.notFound,
      };
    }

    const parsed = parsePublicQRRpc(data);
    if (!parsed) {
      return {
        ok: false,
        code: "UNKNOWN",
        message: PUBLIC_QR_MESSAGES.unexpected,
      };
    }

    return { ok: true, data: toPublicQRData(parsed) };
  },
);

export function canViewQRCodes(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, "qr_codes.view");
}

export function canManageQRCodes(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, "qr_codes.manage");
}

export type QRCodeQueueOption = {
  id: string;
  branch_id: string;
  name: string;
  status: string;
};

export async function listQueuesForQRForm(
  restaurantId: string,
): Promise<QRCodeQueueOption[]> {
  await requirePermission(restaurantId, "qr_codes.view");

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

export function assertCanManageQRCodes(
  role: Parameters<typeof hasPermission>[0],
): void {
  if (!canManageQRCodes(role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to manage QR codes.",
    );
  }
}
