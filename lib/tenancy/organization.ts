import type { Enums, Tables } from "@/types/database";

export type Organization = Tables<"organizations">;
export type OrganizationBusinessType = Enums<"organization_business_type">;
export type OrganizationStatus = Enums<"organization_status">;

export const ORGANIZATION_BUSINESS_TYPES = [
  "RESTAURANT",
  "SALON",
  "CLINIC",
  "CAR_SERVICE",
  "OTHER",
] as const satisfies ReadonlyArray<OrganizationBusinessType>;

/**
 * Resolve the tenant organization id from an authenticated restaurant context.
 * Never trust a client-supplied organizationId for authorization.
 */
export function organizationIdFromRestaurant(
  restaurant:
    Pick<Tables<"restaurants">, "organization_id" | "id"> | null | undefined,
): string | null {
  if (!restaurant) return null;
  return restaurant.organization_id ?? restaurant.id;
}

/**
 * Defense-in-depth tenant match. Prefer 404-style denial in callers.
 */
export function sameOrganization(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return Boolean(left && right && left === right);
}
