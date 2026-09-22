import { safeDatabaseMessage } from "@/lib/errors/action";

export type QueueMutationCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "SUBSCRIPTION_LIMIT_REACHED"
  | "UNKNOWN";

export type QueueRpcError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
} | null;

function combinedRpcText(error: QueueRpcError): string {
  if (!error) {
    return "";
  }

  return [error.message, error.details, error.hint]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    )
    .join("\n");
}

export function mapQueueRpcError(error: QueueRpcError): {
  ok: false;
  code: QueueMutationCode;
  message: string;
} {
  const raw = combinedRpcText(error);
  const match = /\b(QUEUE_[A-Z_]+):\s*([^\n]+)/.exec(raw);
  const key = match?.[1] ?? "";
  const text = match?.[2]?.trim() ?? "";

  switch (key) {
    case "QUEUE_UNAUTHENTICATED":
      return {
        ok: false,
        code: "FORBIDDEN",
        message: text || "Sign in to continue.",
      };
    case "QUEUE_FORBIDDEN":
      return {
        ok: false,
        code: "FORBIDDEN",
        message: text || "You do not have permission.",
      };
    case "QUEUE_NOT_FOUND":
    case "QUEUE_ENTRY_NOT_FOUND":
    case "QUEUE_CUSTOMER_NOT_FOUND":
    case "QUEUE_TABLE_NOT_FOUND":
      return { ok: false, code: "NOT_FOUND", message: text || "Not found." };
    case "QUEUE_CLOSED":
    case "QUEUE_PAUSED":
    case "QUEUE_DISABLED":
    case "QUEUE_MANUAL_ENTRY_DISABLED":
    case "QUEUE_AT_CAPACITY":
    case "QUEUE_VALIDATION":
    case "QUEUE_CUSTOMER_REQUIRED":
    case "QUEUE_INVALID_TRANSITION":
    case "QUEUE_TABLE_REQUIRED":
    case "QUEUE_TABLE_CAPACITY":
    case "QUEUE_TABLE_BRANCH":
    case "QUEUE_EMPTY":
      return {
        ok: false,
        code: "VALIDATION",
        message: text || "Unable to complete that action.",
      };
    case "QUEUE_TABLE_UNAVAILABLE":
    case "QUEUE_CONFLICT":
      return {
        ok: false,
        code: "CONFLICT",
        message: text || "That record was just updated. Try again.",
      };
    case "QUEUE_UNKNOWN":
      return {
        ok: false,
        code: "UNKNOWN",
        message: text || "Unable to update the queue. Please try again.",
      };
    default:
      if (
        error?.code === "42883" ||
        /function gen_random_bytes|function .* does not exist/i.test(raw)
      ) {
        return {
          ok: false,
          code: "UNKNOWN",
          message:
            "Queue token generation is not configured. Apply the latest database migrations and try again.",
        };
      }
      if (error?.code === "23505" || /duplicate key|unique/i.test(raw)) {
        return {
          ok: false,
          code: "CONFLICT",
          message:
            "That update conflicted with another staff action. Try again.",
        };
      }
      if (
        error?.code === "42501" ||
        /permission denied|violates row-level security|\brls\b/i.test(raw)
      ) {
        return {
          ok: false,
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action.",
        };
      }
      return {
        ok: false,
        code: "UNKNOWN",
        message: safeDatabaseMessage(
          { message: raw || error?.message, code: error?.code },
          "Unable to update the queue. Please try again.",
        ),
      };
  }
}
