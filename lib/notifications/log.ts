/**
 * Safe structured logging for notification delivery.
 * Never logs full phone/email, tokens, or message bodies with PII.
 */

export type NotificationLogFields = {
  notificationId?: string;
  restaurantId?: string;
  queueEntryId?: string | null;
  type?: string;
  channel?: string;
  provider?: string;
  attempt?: number;
  result?: "sent" | "failed" | "skipped" | "duplicate" | "pending";
  errorCode?: string;
};

function maskRecipientHint(recipient: string | null | undefined): string | undefined {
  if (!recipient) return undefined;
  const trimmed = recipient.trim();
  if (trimmed.length <= 4) return "***";
  if (trimmed.includes("@")) {
    const [local, domain] = trimmed.split("@");
    if (!domain) return "***";
    return `${(local ?? "").slice(0, 1)}***@${domain}`;
  }
  // Phone-like: keep last 2 digits only
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `***${digits.slice(-2)}`;
  }
  return "***";
}

export function logNotificationEvent(
  message: string,
  fields: NotificationLogFields & { recipientHint?: string },
): void {
  const payload = {
    scope: "notifications",
    message,
    notificationId: fields.notificationId,
    restaurantId: fields.restaurantId,
    queueEntryId: fields.queueEntryId ?? undefined,
    type: fields.type,
    channel: fields.channel,
    provider: fields.provider,
    attempt: fields.attempt,
    result: fields.result,
    errorCode: fields.errorCode,
    recipientHint: fields.recipientHint
      ? maskRecipientHint(fields.recipientHint)
      : undefined,
  };

  if (fields.result === "failed") {
    console.info(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}

export { maskRecipientHint };
