import { AuthorizationError } from "@/lib/auth/guards";

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "UNVERIFIED"
  | "FORBIDDEN"
  | "NO_MEMBERSHIP"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SUBSCRIPTION_LIMIT_REACHED"
  | "SUBSCRIPTION_FEATURE_BLOCKED"
  | "SUBSCRIPTION_DOWNGRADE_BLOCKED"
  | "STORAGE"
  | "RATE_LIMITED"
  | "UNKNOWN";

export type ActionResult<T = undefined> = {
  ok: boolean;
  message?: string;
  code?: ActionErrorCode;
  data?: T;
};

export function actionOk<T = undefined>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  code: ActionErrorCode,
  message: string,
): ActionResult<never> {
  return { ok: false, code, message };
}

export function mapAuthorizationError(
  error: AuthorizationError,
): ActionResult<never> {
  return actionFail(error.code, error.message);
}

export function mapUnknownError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): ActionResult<never> {
  if (error instanceof AuthorizationError) {
    return mapAuthorizationError(error);
  }

  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  if (/duplicate key|unique constraint|already exists/i.test(raw)) {
    return actionFail("CONFLICT", "That value is already in use.");
  }

  if (/network|fetch failed|failed to fetch/i.test(raw)) {
    return actionFail(
      "UNKNOWN",
      "Network error. Check your connection and try again.",
    );
  }

  return actionFail("UNKNOWN", fallback);
}

/** Never expose raw Postgres / Supabase internals to clients. */
export function safeDatabaseMessage(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string,
): string {
  if (!error?.message) {
    return fallback;
  }

  if (
    /restaurant_tables_branch_number_unique|duplicate key.*table_number/i.test(
      error.message,
    )
  ) {
    return "A table with this number already exists in this branch.";
  }

  if (/table_sections_branch_name_unique/i.test(error.message)) {
    return "A section with this name already exists in this branch.";
  }

  if (/table section must belong to the same branch/i.test(error.message)) {
    return "That section does not belong to this branch.";
  }

  if (/restaurant_tables_capacity_positive/i.test(error.message)) {
    return "Capacity must be a positive number.";
  }

  if (
    /duplicate key|unique.*slug|branches_restaurant_slug/i.test(error.message)
  ) {
    return "A branch with this slug already exists.";
  }

  if (/special_hours_.*date_unique/i.test(error.message)) {
    return "A special date already exists for this location.";
  }

  if (
    /operating periods cannot overlap|periods cannot overlap/i.test(
      error.message,
    )
  ) {
    return "Operating periods cannot overlap.";
  }

  if (/closed days cannot contain/i.test(error.message)) {
    return "Closed days cannot contain opening hours.";
  }

  if (/opening time must be before/i.test(error.message)) {
    return "Start time must be before end time.";
  }

  if (/restaurants_slug_unique|duplicate key.*slug/i.test(error.message)) {
    return "A restaurant with this slug already exists. Try a different name.";
  }

  if (/customers_name_not_blank/i.test(error.message)) {
    return "Customer name is required.";
  }

  if (/queues_branch_name_unique/i.test(error.message)) {
    return "A queue with this name already exists in this branch.";
  }

  if (/queue_entries_token_per_queue_day_unique/i.test(error.message)) {
    return "That token was just issued. Try again.";
  }

  if (/queue_entries_active_table_unique/i.test(error.message)) {
    return "That table is already assigned.";
  }

  if (
    /table must belong to the same branch as the queue/i.test(error.message)
  ) {
    return "That table does not belong to this branch.";
  }

  if (
    /violates row-level security|permission denied|rls/i.test(error.message)
  ) {
    return "You do not have permission to perform this action.";
  }

  return fallback;
}
