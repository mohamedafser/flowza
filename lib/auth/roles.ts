import type { Enums } from "@/types/database";

export const MEMBER_ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF"] as const;

export type MemberRole = Enums<"member_role">;

export const ROLE_RANK: Record<MemberRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  MANAGER: 60,
  STAFF: 40,
};

export function isMemberRole(value: unknown): value is MemberRole {
  return (
    typeof value === "string" &&
    (MEMBER_ROLES as readonly string[]).includes(value)
  );
}

export function roleAtLeast(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function compareRoles(a: MemberRole, b: MemberRole): number {
  return ROLE_RANK[a] - ROLE_RANK[b];
}
