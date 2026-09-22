import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type AdminClient = SupabaseClient<Database>;

/**
 * Service-role client for platform admin queries.
 * Callers MUST authorize SUPER_ADMIN before using this.
 */
export function requireAdminClient(): AdminClient {
  const client = createServiceRoleClient();
  if (!client) {
    throw new Error("Service role client is not configured.");
  }
  return client;
}

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function emptyPage<T>(page = 1, pageSize = 20): PageResult<T> {
  return {
    items: [],
    page,
    pageSize,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };
}

export function buildPageResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PageResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
}

export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
