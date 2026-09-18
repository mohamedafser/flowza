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
  AuthorizationError,
  redirectIfAuthenticated,
  requireAuth,
  requirePermission,
  requireRestaurantMembership,
  requireVerifiedAuth,
  requireVerifiedPage,
} from "@/lib/auth/guards";

export {
  ensureProfile,
  getAuthContext,
  getAuthUser,
  getMembershipForRestaurant,
  getUserMemberships,
  isEmailVerified,
  resolvePostAuthDestination,
  resolvePreferredRestaurantId,
  type AuthContext,
  type MembershipWithRestaurant,
  type Profile,
  type Restaurant,
  type RestaurantMember,
} from "@/lib/auth/session";

export { getAuthErrorMessage } from "@/lib/auth/errors";

export * from "@/lib/auth/paths";
