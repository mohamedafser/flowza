export type PublicQRUnavailableReason =
  "inactive" | "unsupported" | "not_found";

export type PublicQRResponse =
  | {
      unavailable: true;
      reason: PublicQRUnavailableReason;
      message: string;
    }
  | {
      unavailable: false;
      type: "QUEUE_JOIN";
      qr: { name: string };
      restaurant: { name: string; slug: string };
      branch: { name: string; slug: string };
      queue: { name: string };
      joinPath: string;
    };

/** Keys that must never appear in public QR payloads. */
export const PUBLIC_QR_SENSITIVE_KEYS = [
  "phone",
  "email",
  "customer",
  "customer_id",
  "customer_name",
  "customer_phone",
  "customer_email",
  "membership",
  "member",
  "staff",
  "user_id",
  "restaurant_id",
  "branch_id",
  "queue_id",
  "qr_code_id",
  "id",
  "public_token",
  "access_token",
  "audit",
  "settings",
] as const;
