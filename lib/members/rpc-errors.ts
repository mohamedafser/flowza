import { safeDatabaseMessage } from "@/lib/errors/action";

export type MemberMutationCode =
  "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "UNKNOWN";

export type MemberRpcError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
} | null;

function combinedRpcText(error: MemberRpcError): string {
  if (!error) {
    return "";
  }

  return [error.message, error.details, error.hint]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    )
    .join("\n");
}

export function mapMemberRpcError(error: MemberRpcError): {
  ok: false;
  code: MemberMutationCode;
  message: string;
} {
  const raw = combinedRpcText(error);
  const match = /\b(MEMBER_[A-Z_]+):\s*([^\n]+)/.exec(raw);
  const key = match?.[1] ?? "";
  const text = match?.[2]?.trim() ?? "";

  switch (key) {
    case "MEMBER_UNAUTHENTICATED":
    case "MEMBER_FORBIDDEN":
      return {
        ok: false,
        code: "FORBIDDEN",
        message: text || "You do not have permission to manage staff.",
      };
    case "MEMBER_NOT_FOUND":
    case "MEMBER_NO_ACCOUNT":
      return {
        ok: false,
        code: "NOT_FOUND",
        message: text || "Staff member not found.",
      };
    case "MEMBER_ALREADY_EXISTS":
      return {
        ok: false,
        code: "CONFLICT",
        message: text || "That person is already part of this organization.",
      };
    case "MEMBER_VALIDATION":
    case "MEMBER_SELF":
    case "MEMBER_LAST_OWNER":
      return {
        ok: false,
        code: "VALIDATION",
        message: text || "Unable to complete that change.",
      };
    default:
      if (error?.code === "23505" || /duplicate key|unique/i.test(raw)) {
        return {
          ok: false,
          code: "CONFLICT",
          message: "That person is already part of this organization.",
        };
      }
      if (
        error?.code === "42501" ||
        /permission denied|violates row-level security|\brls\b/i.test(raw)
      ) {
        return {
          ok: false,
          code: "FORBIDDEN",
          message: "You do not have permission to manage staff.",
        };
      }
      return {
        ok: false,
        code: "UNKNOWN",
        message: safeDatabaseMessage(
          { message: raw || error?.message, code: error?.code },
          "Unable to update staff. Please try again.",
        ),
      };
  }
}
