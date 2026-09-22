import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import type { adminAuditListSchema } from "@/lib/validations/admin";
import {
  buildPageResult,
  emptyPage,
  escapeIlike,
  requireAdminClient,
  type PageResult,
} from "@/services/admin/admin-client";
import type { z } from "zod";

export type AdminAuditListQuery = z.infer<typeof adminAuditListSchema>;

export type AdminAuditListItem = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  restaurantId: string | null;
  restaurantName: string | null;
  actorId: string | null;
  actorName: string | null;
  status: "ok";
};

export async function listAdminAuditLogs(
  query: AdminAuditListQuery,
): Promise<PageResult<AdminAuditListItem>> {
  await requirePlatformPermission("platform.audit_logs.view");
  const admin = requireAdminClient();
  const { page, pageSize } = query;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let auditQuery = admin
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.actorId) {
    auditQuery = auditQuery.eq("user_id", query.actorId);
  }
  if (query.restaurantId) {
    auditQuery = auditQuery.eq("restaurant_id", query.restaurantId);
  }
  if (query.action) {
    auditQuery = auditQuery.eq("action", query.action);
  }
  if (query.from) {
    auditQuery = auditQuery.gte("created_at", query.from);
  }
  if (query.to) {
    auditQuery = auditQuery.lte("created_at", query.to);
  }

  const search = query.q?.trim();
  if (search) {
    const like = `%${escapeIlike(search)}%`;
    auditQuery = auditQuery.or(
      `action.ilike.${like},entity_type.ilike.${like},entity_id.ilike.${like}`,
    );
  }

  const { data: rows, count, error } = await auditQuery;
  if (error || !rows) return emptyPage(page, pageSize);

  const restaurantIds = [
    ...new Set(
      rows
        .map((r) => r.restaurant_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const actorIds = [
    ...new Set(
      rows.map((r) => r.user_id).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: restaurants }, { data: profiles }] = await Promise.all([
    restaurantIds.length
      ? admin.from("restaurants").select("id, name").in("id", restaurantIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    actorIds.length
      ? admin.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string | null }[],
        }),
  ]);

  const restaurantName = new Map(
    (restaurants ?? []).map((r) => [r.id, r.name] as const),
  );
  const actorName = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name] as const),
  );

  const items: AdminAuditListItem[] = rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_id
      ? (restaurantName.get(row.restaurant_id) ?? null)
      : null,
    actorId: row.user_id,
    actorName: row.user_id ? (actorName.get(row.user_id) ?? null) : null,
    status: "ok",
  }));

  return buildPageResult(items, count ?? items.length, page, pageSize);
}
