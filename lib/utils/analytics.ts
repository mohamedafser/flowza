import { hasPermission } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/auth/roles";

export function canViewAnalytics(role: MemberRole): boolean {
  return hasPermission(role, "analytics.view");
}

export function canExportAnalytics(role: MemberRole): boolean {
  return hasPermission(role, "analytics.view");
}
