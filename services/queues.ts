import { cache } from "react";
import {
  AuthorizationError,
  requirePermission,
  requireVerifiedAuth,
} from "@/lib/auth/guards";
import { safeDatabaseMessage } from "@/lib/errors/action";
import { createClient } from "@/lib/supabase/server";
import { estimateWaitTime } from "@/lib/queue/estimateWaitTime";
import {
  mapQueueRpcError,
  type QueueMutationCode,
  type QueueRpcError,
} from "@/lib/queue/rpc-errors";
import { canTransitionQueueStatus } from "@/lib/queue/transitions";
import { businessDateForTimezone } from "@/lib/queue/tokens";
import { resolveBranchTimezone } from "@/lib/utils/timezone";
import {
  isDateFormat,
  isTimeFormat,
  type DateFormat,
  type TimeFormat,
} from "@/lib/utils/datetime";
import {
  authorizeQueueScope,
  canConfigureQueue,
  deriveQueueStatistics,
  pickQueue,
  type QueueCustomerSummary,
  type QueueEntryRecord,
  type QueueEntryWithRelations,
  type QueueRecord,
  type QueueStats,
  type QueueTableSummary,
} from "@/lib/utils/queue";
import type {
  AddCustomerToQueueInput,
  CreateQueueInput,
  QueueEntryStatus,
  UpdateQueueInput,
  UpdateQueueStatusInput,
} from "@/lib/validations/queue";
import { scheduleNotificationWork } from "@/lib/notifications/service";
import { findPotentialDuplicateCustomer } from "@/services/customers";
import { writeAuditLog } from "@/services/audit";
import { releaseExpiredCleaningTables } from "@/services/table-cleaning";
import type { Branch } from "@/lib/context/restaurant";
import type { RestaurantSettings } from "@/services/settings";
import type { RestaurantTableRecord } from "@/lib/utils/tables";
import type { Json, Tables } from "@/types/database";

export type {
  QueueCustomerSummary,
  QueueEntryRecord,
  QueueEntryWithRelations,
  QueueRecord,
  QueueStats,
  QueueTableSummary,
};

export type QueueEntryView = QueueEntryWithRelations & {
  position: number | null;
  partiesAhead: number;
  estimatedWaitMinutes: number | null;
};

export type QueueDefaults = {
  defaultQueueName: string;
  tokenPrefix: string;
  startingTokenNumber: number;
  defaultServiceMinutes: number;
  maxQueueCapacity: number | null;
  queueEnabled: boolean;
  allowWalkIns: boolean;
  allowManualEntry: boolean;
};

export type QueueBundle = {
  branch: Branch;
  timezone: string;
  businessDate: string;
  queues: QueueRecord[];
  queue: QueueRecord | null;
  entries: QueueEntryView[];
  stats: QueueStats;
  tables: RestaurantTableRecord[];
  defaults: QueueDefaults;
  estimatedServiceMinutes: number;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
};

export type { QueueMutationCode };

export type QueueMutationResult =
  | { ok: true; queue: QueueRecord }
  | { ok: false; message: string; code: QueueMutationCode };

export type QueueEntryMutationResult =
  | { ok: true; entry: QueueEntryRecord }
  | { ok: false; message: string; code: QueueMutationCode };

export type QueueCustomerSearchResult = {
  id: string;
  name: string;
  phone: string | null;
};

type QueueRow = Tables<"queues">;
type QueueEntryRow = Tables<"queue_entries">;

type CustomerJoin =
  { id: string; name: string } | { id: string; name: string }[] | null;

type TableJoin =
  | {
      id: string;
      table_number: string;
      name: string | null;
      capacity: number;
      status: string;
      branch_id: string;
    }
  | {
      id: string;
      table_number: string;
      name: string | null;
      capacity: number;
      status: string;
      branch_id: string;
    }[]
  | null;

type QueueEntryRowWithJoins = QueueEntryRow & {
  customer: CustomerJoin;
  table: TableJoin;
};

const ENTRY_SELECT =
  "id, queue_id, customer_id, table_id, token, business_date, party_size, status, joined_at, called_at, seated_at, completed_at, cancelled_at, skipped_at, no_show_at, created_at, updated_at, customer:customers(id, name), table:restaurant_tables(id, table_number, name, capacity, status, branch_id)";

const QUEUE_SELECT =
  "id, organization_id, branch_id, name, status, prefix, current_number, starting_number, estimated_service_minutes, created_at, updated_at";

const TABLE_SELECT =
  "id, branch_id, section_id, table_number, name, capacity, status, sort_order, cleaning_started_at";

const SETTINGS_SELECT =
  "default_queue_name, token_prefix, starting_token_number, default_service_minutes, max_queue_capacity, queue_enabled, allow_walk_ins, allow_manual_entry, date_format, time_format";

const BRANCH_SELECT =
  "id, organization_id, restaurant_id, name, slug, timezone, use_restaurant_timezone, is_active";

function asQueue(row: QueueRow): QueueRecord {
  return {
    id: row.id,
    organization_id: row.organization_id,
    branch_id: row.branch_id,
    name: row.name,
    status: row.status,
    prefix: row.prefix,
    current_number: row.current_number,
    starting_number: row.starting_number,
    estimated_service_minutes: row.estimated_service_minutes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function asEntry(row: QueueEntryRow): QueueEntryRecord {
  return {
    id: row.id,
    queue_id: row.queue_id,
    customer_id: row.customer_id,
    table_id: row.table_id,
    token: row.token,
    business_date: row.business_date,
    party_size: row.party_size,
    status: row.status,
    joined_at: row.joined_at,
    called_at: row.called_at,
    seated_at: row.seated_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    skipped_at: row.skipped_at,
    no_show_at: row.no_show_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCustomerJoin(value: CustomerJoin): QueueCustomerSummary | null {
  if (!value) return null;
  const row = Array.isArray(value) ? (value[0] ?? null) : value;
  return row ? { id: row.id, name: row.name } : null;
}

function mapTableJoin(value: TableJoin): QueueTableSummary | null {
  if (!value) return null;
  const row = Array.isArray(value) ? (value[0] ?? null) : value;
  return row
    ? {
        id: row.id,
        table_number: row.table_number,
        name: row.name,
        capacity: row.capacity,
        status: row.status,
        branch_id: row.branch_id,
      }
    : null;
}

function asEntryWithRelations(
  row: QueueEntryRowWithJoins,
): QueueEntryWithRelations {
  return {
    ...asEntry(row),
    customer: mapCustomerJoin(row.customer),
    table: mapTableJoin(row.table),
  };
}

function asTable(row: Tables<"restaurant_tables">): RestaurantTableRecord {
  return {
    id: row.id,
    branch_id: row.branch_id,
    section_id: row.section_id,
    table_number: row.table_number,
    name: row.name,
    capacity: row.capacity,
    status: row.status,
    sort_order: row.sort_order,
    cleaning_started_at: row.cleaning_started_at,
  };
}

function defaultsFromSettings(
  settings: RestaurantSettings | null,
): QueueDefaults {
  return {
    defaultQueueName: settings?.default_queue_name ?? "Main Queue",
    tokenPrefix: settings?.token_prefix ?? "A",
    startingTokenNumber: settings?.starting_token_number ?? 1,
    defaultServiceMinutes: settings?.default_service_minutes ?? 15,
    maxQueueCapacity: settings?.max_queue_capacity ?? null,
    queueEnabled: settings?.queue_enabled ?? true,
    allowWalkIns: settings?.allow_walk_ins ?? true,
    allowManualEntry: settings?.allow_manual_entry ?? true,
  };
}

function serviceMinutesForQueue(
  queue: QueueRecord | null,
  defaults: QueueDefaults,
): number {
  return queue?.estimated_service_minutes ?? defaults.defaultServiceMinutes;
}

function withEstimates(
  entries: QueueEntryWithRelations[],
  estimatedServiceMinutes: number,
): QueueEntryView[] {
  return entries.map((entry) => {
    const estimate = estimateWaitTime({
      entries,
      entryId: entry.id,
      estimatedServiceMinutes,
    });
    return {
      ...entry,
      position: estimate.position,
      partiesAhead: estimate.partiesAhead,
      estimatedWaitMinutes: estimate.estimatedWaitMinutes,
    };
  });
}

function queueMutationFromRpc(error: QueueRpcError): {
  ok: false;
  code: QueueMutationCode;
  message: string;
} {
  if (error) {
    console.error("queue rpc failed", {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    });
  } else {
    console.error("queue rpc returned no row");
  }

  const mapped = mapQueueRpcError(error);
  if (process.env.NODE_ENV === "production") {
    return mapped;
  }

  const detail = error
    ? [error.code, error.message, error.details, error.hint]
        .filter(
          (part): part is string => typeof part === "string" && part.length > 0,
        )
        .join(" | ")
    : "no RPC error payload";

  return {
    ...mapped,
    message: `${mapped.message} [${detail}]`,
  };
}

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%_,*()\\']/g, "").trim();
}

async function loadAuthorizedBranch(
  branchId: string,
  permission: "queue.view" | "queue.manage",
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select(BRANCH_SELECT)
    .eq("id", branchId)
    .maybeSingle();

  if (error || !data) {
    throw new AuthorizationError("FORBIDDEN", "Branch not found.");
  }

  const context = await requirePermission(data.restaurant_id, permission);
  return { branch: data as unknown as Branch, context };
}

function scheduleQueueNotification(
  kind: "joined" | "called" | "cancelled" | "no_show" | "seated",
  entryId: string,
): void {
  scheduleNotificationWork(async () => {
    const {
      notifyQueueJoined,
      notifyQueueCalled,
      notifyQueueCancelled,
      notifyQueueNoShow,
      notifyQueueSeated,
    } = await import("@/lib/notifications/queue");

    switch (kind) {
      case "joined":
        await notifyQueueJoined(entryId);
        return;
      case "called":
        await notifyQueueCalled(entryId);
        return;
      case "cancelled":
        await notifyQueueCancelled(entryId);
        return;
      case "no_show":
        await notifyQueueNoShow(entryId);
        return;
      case "seated":
        await notifyQueueSeated(entryId);
        return;
    }
  });
}

async function loadAuthorizedQueue(
  queueId: string,
  permission: "queue.view" | "queue.manage",
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("queues")
    .select(QUEUE_SELECT)
    .eq("id", queueId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const authorized = await loadAuthorizedBranch(data.branch_id, permission);
  const organizationId =
    authorized.context.organizationId ??
    authorized.branch.organization_id ??
    data.organization_id;

  if (data.organization_id !== organizationId) {
    return null;
  }

  const scoped = authorizeQueueScope({
    membershipRestaurantId: authorized.context.membership.restaurant_id,
    queueRestaurantId: authorized.branch.restaurant_id,
    currentRestaurantId: authorized.branch.restaurant_id,
    queueBranchId: data.branch_id,
    expectedBranchId: authorized.branch.id,
    membershipOrganizationId: organizationId,
    queueOrganizationId: data.organization_id,
    currentOrganizationId: organizationId,
  });

  if (!scoped.ok) {
    return null;
  }

  return { queue: asQueue(data), ...authorized };
}

export const getQueueBundle = cache(
  async (
    branchId: string,
    preferredQueueId?: string | null,
  ): Promise<QueueBundle> => {
    const { branch, context } = await loadAuthorizedBranch(
      branchId,
      "queue.view",
    );
    const timezone = resolveBranchTimezone({
      restaurantTimezone: context.membership.restaurant.timezone,
      branchTimezone: branch.timezone,
      useRestaurantTimezone: branch.use_restaurant_timezone,
    });
    const businessDate = businessDateForTimezone(new Date(), timezone);
    const supabase = await createClient();
    const knownQueueId = preferredQueueId?.trim() || null;

    await releaseExpiredCleaningTables(supabase, branch.id);

    const [queuesResult, settingsResult, tablesResult, knownEntriesResult] =
      await Promise.all([
        supabase
          .from("queues")
          .select(QUEUE_SELECT)
          .eq("branch_id", branch.id)
          .order("name", { ascending: true }),
        supabase
          .from("restaurant_settings")
          .select(SETTINGS_SELECT)
          .eq("restaurant_id", branch.restaurant_id)
          .maybeSingle(),
        supabase
          .from("restaurant_tables")
          .select(TABLE_SELECT)
          .eq("branch_id", branch.id)
          .order("sort_order", { ascending: true })
          .order("table_number", { ascending: true }),
        knownQueueId
          ? supabase
              .from("queue_entries")
              .select(ENTRY_SELECT)
              .eq("queue_id", knownQueueId)
              .eq("business_date", businessDate)
              .order("joined_at", { ascending: true })
              .order("id", { ascending: true })
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (queuesResult.error) {
      throw new Error("Unable to load queues.");
    }

    const queues = (queuesResult.data ?? []).map((row) =>
      asQueue(row as QueueRow),
    );
    const queue = pickQueue(queues, preferredQueueId);
    const settings = settingsResult.data ?? null;
    const defaults = defaultsFromSettings(
      settings as RestaurantSettings | null,
    );
    const estimatedServiceMinutes = serviceMinutesForQueue(queue, defaults);
    const tables = (tablesResult.data ?? []).map((row) =>
      asTable(row as Tables<"restaurant_tables">),
    );
    const rawDateFormat = settings?.date_format ?? "DD/MM/YYYY";
    const rawTimeFormat = settings?.time_format ?? "12h";
    const dateFormat: DateFormat = isDateFormat(rawDateFormat)
      ? rawDateFormat
      : "DD/MM/YYYY";
    const timeFormat: TimeFormat = isTimeFormat(rawTimeFormat)
      ? rawTimeFormat
      : "12h";

    let entries: QueueEntryView[] = [];
    if (queue) {
      let entryRows = knownEntriesResult.data;
      // Prefer parallel prefetched rows only when they match the selected queue.
      if (
        !knownQueueId ||
        queue.id !== knownQueueId ||
        knownEntriesResult.error
      ) {
        const { data, error } = await supabase
          .from("queue_entries")
          .select(ENTRY_SELECT)
          .eq("queue_id", queue.id)
          .eq("business_date", businessDate)
          .order("joined_at", { ascending: true })
          .order("id", { ascending: true });

        if (error) {
          throw new Error("Unable to load queue entries.");
        }
        entryRows = data;
      }

      entries = withEstimates(
        (entryRows ?? []).map((row) =>
          asEntryWithRelations(row as QueueEntryRowWithJoins),
        ),
        estimatedServiceMinutes,
      );
    }

    return {
      branch: branch as Branch,
      timezone,
      businessDate,
      queues,
      queue,
      entries,
      stats: deriveQueueStatistics(entries),
      tables,
      defaults,
      estimatedServiceMinutes,
      dateFormat,
      timeFormat,
    };
  },
);

export async function getQueues(branchId: string): Promise<QueueRecord[]> {
  const bundle = await getQueueBundle(branchId);
  return bundle.queues;
}

export async function getQueue(queueId: string): Promise<QueueRecord | null> {
  const loaded = await loadAuthorizedQueue(queueId, "queue.view");
  return loaded?.queue ?? null;
}

export async function getQueueEntries(
  queueId: string,
): Promise<QueueEntryView[]> {
  const loaded = await loadAuthorizedQueue(queueId, "queue.view");
  if (!loaded) return [];
  const bundle = await getQueueBundle(loaded.branch.id, queueId);
  return bundle.entries;
}

export async function getQueueEntry(
  entryId: string,
): Promise<QueueEntryView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("queue_entries")
    .select(ENTRY_SELECT)
    .eq("id", entryId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const loaded = await loadAuthorizedQueue(data.queue_id, "queue.view");
  if (!loaded) {
    return null;
  }

  const bundle = await getQueueBundle(loaded.branch.id, loaded.queue.id);
  return bundle.entries.find((entry) => entry.id === entryId) ?? null;
}

export async function getQueueStats(queueId: string): Promise<QueueStats> {
  const loaded = await loadAuthorizedQueue(queueId, "queue.view");
  if (!loaded) {
    return deriveQueueStatistics([]);
  }
  const bundle = await getQueueBundle(loaded.branch.id, queueId);
  return bundle.stats;
}

export async function getQueueHistory(
  queueId: string,
): Promise<QueueEntryView[]> {
  const entries = await getQueueEntries(queueId);
  return entries.filter(
    (entry) =>
      entry.status === "COMPLETED" ||
      entry.status === "SKIPPED" ||
      entry.status === "CANCELLED" ||
      entry.status === "NO_SHOW",
  );
}

export async function searchQueueCustomers(
  query: string,
): Promise<QueueCustomerSearchResult[]> {
  const trimmed = sanitizeSearchTerm(query);

  const auth = await requireVerifiedAuth();
  if (!auth.restaurant) {
    throw new AuthorizationError(
      "NO_MEMBERSHIP",
      "You do not belong to this restaurant.",
    );
  }

  // Membership already loaded by requireVerifiedAuth; enforce queue.view only.
  await requirePermission(auth.restaurant.id, "queue.view");
  const supabase = await createClient();

  const request = trimmed
    ? supabase
        .from("customers")
        .select("id, name, phone")
        .eq("restaurant_id", auth.restaurant.id)
        .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
        .order("name", { ascending: true })
        .limit(20)
    : supabase
        .from("customers")
        .select("id, name, phone")
        .eq("restaurant_id", auth.restaurant.id)
        .order("updated_at", { ascending: false })
        .limit(5);

  const { data, error } = await request;

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
  }));
}

export async function createQueue(
  input: CreateQueueInput,
): Promise<QueueMutationResult> {
  const { branch, context } = await loadAuthorizedBranch(
    input.branchId,
    "queue.manage",
  );

  if (!canConfigureQueue(context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to create queues.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("queues")
    .insert({
      branch_id: branch.id,
      name: input.name,
      prefix: input.prefix,
      starting_number: input.startingNumber,
      current_number: Math.max(0, input.startingNumber - 1),
      estimated_service_minutes: input.estimatedServiceMinutes,
      status: input.status,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /queues_branch_name_unique|duplicate key/i.test(error.message)
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to create queue. Please try again.",
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "Unable to create queue. Please try again.",
    };
  }

  const queue = asQueue(data);
  await writeAuditLog({
    restaurantId: branch.restaurant_id,
    userId: context.user.id,
    action: "queue.created",
    entityType: "queue",
    entityId: queue.id,
    metadata: {
      branchId: branch.id,
      name: queue.name,
      prefix: queue.prefix,
      status: queue.status,
    },
  });

  return { ok: true, queue };
}

export async function updateQueue(
  input: UpdateQueueInput,
): Promise<QueueMutationResult> {
  const loaded = await loadAuthorizedQueue(input.queueId, "queue.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Queue not found." };
  }

  if (!canConfigureQueue(loaded.context.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "You do not have permission to update queue settings.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("queues")
    .update({
      name: input.name,
      prefix: input.prefix,
      starting_number: input.startingNumber,
      estimated_service_minutes: input.estimatedServiceMinutes,
      status: input.status,
    })
    .eq("id", loaded.queue.id)
    .eq("branch_id", loaded.branch.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: /queues_branch_name_unique|duplicate key/i.test(error.message)
        ? "CONFLICT"
        : "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update queue. Please try again.",
      ),
    };
  }

  if (!data) {
    return { ok: false, code: "NOT_FOUND", message: "Queue not found." };
  }

  const queue = asQueue(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "queue.updated",
    entityType: "queue",
    entityId: queue.id,
    metadata: {
      branchId: loaded.branch.id,
      name: queue.name,
      prefix: queue.prefix,
      status: queue.status,
    },
  });

  return { ok: true, queue };
}

function statusAuditAction(
  status: QueueRecord["status"],
): "queue.paused" | "queue.resumed" | "queue.closed" | "queue.updated" {
  if (status === "PAUSED") return "queue.paused";
  if (status === "CLOSED") return "queue.closed";
  return "queue.resumed";
}

export async function updateQueueStatus(
  input: UpdateQueueStatusInput,
): Promise<QueueMutationResult> {
  const loaded = await loadAuthorizedQueue(input.queueId, "queue.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Queue not found." };
  }

  if (loaded.queue.status === input.status) {
    return { ok: true, queue: loaded.queue };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("queues")
    .update({ status: input.status })
    .eq("id", loaded.queue.id)
    .eq("branch_id", loaded.branch.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: safeDatabaseMessage(
        error,
        "Unable to update queue status. Please try again.",
      ),
    };
  }

  const queue = asQueue(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: statusAuditAction(queue.status),
    entityType: "queue",
    entityId: queue.id,
    metadata: {
      branchId: loaded.branch.id,
      from: loaded.queue.status,
      to: queue.status,
    },
  });

  return { ok: true, queue };
}

export async function addCustomerToQueue(
  input: AddCustomerToQueueInput,
): Promise<QueueEntryMutationResult> {
  const loaded = await loadAuthorizedQueue(input.queueId, "queue.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Queue not found." };
  }

  try {
    const { assertUsageLimit } =
      await import("@/services/billing/entitlement.service");
    await assertUsageLimit(loaded.branch.restaurant_id, "queue_entries");
  } catch (error) {
    const { isSubscriptionLimitError } = await import("@/lib/billing/errors");
    if (isSubscriptionLimitError(error)) {
      return {
        ok: false,
        code: "SUBSCRIPTION_LIMIT_REACHED",
        message: error.message,
      };
    }
    throw error;
  }

  const supabase = await createClient();
  let customerId = input.customerId ?? null;

  if (customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, restaurant_id")
      .eq("id", customerId)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, code: "NOT_FOUND", message: "Customer not found." };
    }

    if (data.restaurant_id !== loaded.branch.restaurant_id) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Customer does not belong to this restaurant.",
      };
    }
  } else {
    const name = input.name?.trim() ?? "";
    if (!name) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Customer name is required.",
      };
    }
    if (!input.phone) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Phone number is required.",
      };
    }

    const duplicate = await findPotentialDuplicateCustomer(
      loaded.branch.restaurant_id,
      {
        phone: input.phone,
        email: input.email ?? null,
      },
    );
    if (duplicate) {
      customerId = duplicate.id;
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          restaurant_id: loaded.branch.restaurant_id,
          name,
          phone: input.phone,
          email: input.email ?? null,
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        const raced = await findPotentialDuplicateCustomer(
          loaded.branch.restaurant_id,
          {
            phone: input.phone,
            email: input.email ?? null,
          },
        );
        if (raced) {
          customerId = raced.id;
        } else {
          return {
            ok: false,
            code: /duplicate key|unique/i.test(error?.message ?? "")
              ? "CONFLICT"
              : "UNKNOWN",
            message: safeDatabaseMessage(
              error,
              "Unable to create customer. Please try again.",
            ),
          };
        }
      } else {
        customerId = data.id;
        await writeAuditLog({
          restaurantId: loaded.branch.restaurant_id,
          userId: loaded.context.user.id,
          action: "customer.created",
          entityType: "customer",
          entityId: customerId,
          metadata: {
            source: "queue",
            hasPhone: true,
            hasEmail: Boolean(input.email),
          },
        });
      }
    }
  }

  const { data, error } = await supabase.rpc("queue_enqueue_customer", {
    p_queue_id: loaded.queue.id,
    p_party_size: input.partySize,
    p_customer_id: customerId,
    p_customer_name: null,
    p_customer_phone: null,
    p_customer_email: null,
  });

  if (error || !data) {
    return queueMutationFromRpc(error);
  }

  const entry = asEntry(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "queue.entry_joined",
    entityType: "queue_entry",
    entityId: entry.id,
    metadata: {
      queueId: loaded.queue.id,
      branchId: loaded.branch.id,
      partySize: entry.party_size,
      businessDate: entry.business_date,
    },
  });

  scheduleQueueNotification("joined", entry.id);

  return { ok: true, entry };
}

export async function callNextQueueEntry(
  queueId: string,
): Promise<QueueEntryMutationResult> {
  const loaded = await loadAuthorizedQueue(queueId, "queue.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Queue not found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("queue_call_next", {
    p_queue_id: loaded.queue.id,
  });

  if (error || !data) {
    return queueMutationFromRpc(error);
  }

  const entry = asEntry(data);
  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action: "queue.entry_called",
    entityType: "queue_entry",
    entityId: entry.id,
    metadata: { queueId: loaded.queue.id, branchId: loaded.branch.id },
  });

  scheduleQueueNotification("called", entry.id);

  return { ok: true, entry };
}

async function transitionEntry(
  entryId: string,
  toStatus: QueueEntryStatus,
  tableId: string | null,
  action:
    | "queue.entry_called"
    | "queue.entry_skipped"
    | "queue.entry_cancelled"
    | "queue.entry_no_show"
    | "queue.entry_seated"
    | "queue.entry_completed",
): Promise<QueueEntryMutationResult> {
  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("queue_entries")
    .select("id, queue_id, status")
    .eq("id", entryId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, code: "NOT_FOUND", message: "Queue entry not found." };
  }

  const loaded = await loadAuthorizedQueue(existing.queue_id, "queue.manage");
  if (!loaded) {
    return { ok: false, code: "NOT_FOUND", message: "Queue entry not found." };
  }

  if (!canTransitionQueueStatus(existing.status, toStatus)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "That status change is not allowed.",
    };
  }

  const { data, error } = await supabase.rpc("queue_transition_entry", {
    p_entry_id: existing.id,
    p_to_status: toStatus,
    p_table_id: tableId,
  });

  if (error || !data) {
    return queueMutationFromRpc(error);
  }

  const entry = asEntry(data);

  // Keep restaurant_tables status in sync with queue seating (AVAILABLE ↔ OCCUPIED).
  if (toStatus === "SEATED" && tableId) {
    await supabase
      .from("restaurant_tables")
      .update({ status: "OCCUPIED" })
      .eq("id", tableId)
      .eq("branch_id", loaded.branch.id);
  }

  if (toStatus === "COMPLETED" && entry.table_id) {
    await supabase
      .from("restaurant_tables")
      .update({ status: "AVAILABLE" })
      .eq("id", entry.table_id)
      .eq("branch_id", loaded.branch.id)
      .eq("status", "OCCUPIED");
  }

  const metadata: Record<string, Json | undefined> = {
    queueId: loaded.queue.id,
    branchId: loaded.branch.id,
    from: existing.status,
    to: toStatus,
  };
  if (tableId) {
    metadata.tableId = tableId;
  } else if (entry.table_id) {
    metadata.tableId = entry.table_id;
  }

  await writeAuditLog({
    restaurantId: loaded.branch.restaurant_id,
    userId: loaded.context.user.id,
    action,
    entityType: "queue_entry",
    entityId: entry.id,
    metadata,
  });

  if (toStatus === "CALLED") {
    scheduleQueueNotification("called", entry.id);
  } else if (toStatus === "CANCELLED") {
    scheduleQueueNotification("cancelled", entry.id);
  } else if (toStatus === "NO_SHOW") {
    scheduleQueueNotification("no_show", entry.id);
  } else if (toStatus === "SEATED") {
    scheduleQueueNotification("seated", entry.id);
  }

  return { ok: true, entry };
}

export async function callQueueEntry(
  entryId: string,
): Promise<QueueEntryMutationResult> {
  return transitionEntry(entryId, "CALLED", null, "queue.entry_called");
}

export async function skipQueueEntry(
  entryId: string,
): Promise<QueueEntryMutationResult> {
  return transitionEntry(entryId, "SKIPPED", null, "queue.entry_skipped");
}

export async function cancelQueueEntry(
  entryId: string,
): Promise<QueueEntryMutationResult> {
  return transitionEntry(entryId, "CANCELLED", null, "queue.entry_cancelled");
}

export async function markQueueEntryNoShow(
  entryId: string,
): Promise<QueueEntryMutationResult> {
  return transitionEntry(entryId, "NO_SHOW", null, "queue.entry_no_show");
}

export async function seatQueueEntry(
  entryId: string,
  tableId: string,
): Promise<QueueEntryMutationResult> {
  return transitionEntry(entryId, "SEATED", tableId, "queue.entry_seated");
}

export async function completeQueueEntry(
  entryId: string,
): Promise<QueueEntryMutationResult> {
  return transitionEntry(entryId, "COMPLETED", null, "queue.entry_completed");
}
