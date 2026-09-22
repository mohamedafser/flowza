import { CLEANING_AUTO_AVAILABLE_MINUTES } from "@/lib/utils/tables";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Flip CLEANING → AVAILABLE after the auto window.
 * No-op when staff already changed status away from CLEANING.
 */
export async function releaseExpiredCleaningTables(
  supabase: SupabaseClient,
  branchId?: string | null,
  minutes = CLEANING_AUTO_AVAILABLE_MINUTES,
): Promise<number> {
  const { data, error } = await supabase.rpc("release_expired_cleaning_tables", {
    p_branch_id: branchId ?? null,
    p_minutes: minutes,
  });
  if (error) {
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
