export {
  MEMBER_ROLES,
  ROLE_RANK,
  compareRoles,
  isMemberRole,
  roleAtLeast,
  type MemberRole,
} from "@/lib/auth/roles";

export {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  permissionsForRole,
  type Permission,
} from "@/lib/auth/permissions";

export {
  canAccessHref,
  filterNavByRole,
  requiredPermissionForHref,
} from "@/lib/auth/navigation";

export {
  AuthorizationError,
  redirectIfAuthenticated,
  requireAuth,
  requireOrganizationMembership,
  requirePermission,
  requireRestaurantMembership,
  requireVerifiedAuth,
  requireVerifiedPage,
} from "@/lib/auth/guards";

export {
  ensureProfile,
  getAuthContext,
  getAuthUser,
  getMembershipForOrganization,
  getMembershipForRestaurant,
  getUserMemberships,
  isEmailVerified,
  resolvePostAuthDestination,
  resolvePreferredRestaurantId,
  type AuthContext,
  type MembershipWithRestaurant,
  type Organization,
  type Profile,
  type Restaurant,
  type RestaurantMember,
} from "@/lib/auth/session";

export { getAuthErrorMessage } from "@/lib/auth/errors";

export * from "@/lib/auth/paths";
