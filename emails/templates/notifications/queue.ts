import {
  emailButtonHtml,
  emailCardHtml,
  emailGreetingHtml,
  emailGreetingText,
  emailHeadingHtml,
  emailInfoTableHtml,
  emailParagraphHtml,
  emailStatusHtml,
} from "@/emails/components";
import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from "@/emails/theme";
import {
  absoluteUrl,
  escapeHtml,
  safeValue,
} from "@/emails/utils/personalize";
import { renderEmail } from "@/emails/utils/render";
import type { EmailRenderResult } from "@/emails/utils/types";
import { joinText } from "@/emails/utils/types";
import { PUBLIC_QUEUE_PATH } from "@/lib/auth/paths";

export type QueueEmailData = {
  customerName?: string | null;
  restaurantName?: string | null;
  branchName?: string | null;
  token?: string | null;
  partySize?: string | number | null;
  estimatedWait?: string | number | null;
  position?: string | number | null;
  queueName?: string | null;
  tableName?: string | null;
  actionUrl?: string | null;
};

function restaurantLabel(data: QueueEmailData): string {
  return safeValue(data.restaurantName, "the restaurant");
}

function statusUrl(data: QueueEmailData): string {
  return data.actionUrl?.trim() || absoluteUrl(PUBLIC_QUEUE_PATH);
}

function tokenCard(token: string, caption?: string): string {
  const captionHtml = caption
    ? `<p class="email-muted" style="margin:8px 0 0;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:13px;color:${EMAIL_COLORS.textMuted};">${escapeHtml(caption)}</p>`
    : "";
  return emailCardHtml({
    accent: "otp",
    children: `
      <p style="margin:0 0 6px;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted};">Token</p>
      <p class="email-text" style="margin:0;font-family:${EMAIL_TYPOGRAPHY.monoFamily};font-size:28px;font-weight:700;letter-spacing:0.12em;color:${EMAIL_COLORS.primary};">${escapeHtml(token)}</p>
      ${captionHtml}
    `,
  });
}

export function renderQueueJoinedEmail(data: QueueEmailData): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const token = safeValue(data.token, "—");
  const url = statusUrl(data);

  const htmlBody = [
    emailStatusHtml({ tone: "INFO", label: "In queue" }),
    emailHeadingHtml("You're in the queue"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `You've successfully joined the queue at ${restaurant}${data.branchName ? ` (${safeValue(data.branchName)})` : ""}.`,
    ),
    tokenCard(token, "Show this token when you arrive"),
    emailCardHtml({
      children: emailInfoTableHtml([
        { label: "Token", value: token },
        { label: "Party size", value: data.partySize },
        { label: "Position", value: data.position },
        { label: "Estimated wait", value: data.estimatedWait ?? "unavailable" },
      ]),
    }),
    emailButtonHtml({
      href: url,
      label: "View Queue Status",
      variant: "primary",
    }),
  ].join("");

  const textBody = joinText(
    "You're in the queue",
    "",
    emailGreetingText(data.customerName),
    "",
    `You've successfully joined the queue at ${restaurant}.`,
    "",
    `Token: ${token}`,
    `Party size: ${safeValue(data.partySize)}`,
    `Position: ${safeValue(data.position)}`,
    `Estimated wait: ${safeValue(data.estimatedWait, "unavailable")}`,
    "",
    `View queue status: ${url}`,
  );

  return renderEmail({
    subject: `You're in the queue at ${restaurant}`,
    badge: "Queue",
    preheader: `Token ${token} · you're in line`,
    htmlBody,
    textBody,
  });
}

export function renderQueueCalledEmail(data: QueueEmailData): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const token = safeValue(data.token, "—");
  const url = statusUrl(data);

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Your turn" }),
    emailHeadingHtml("It's your turn"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(`Your table is ready at ${restaurant}.`),
    tokenCard(token, "Please proceed to the host stand"),
    emailButtonHtml({
      href: url,
      label: "View Queue Status",
      variant: "success",
    }),
  ].join("");

  const textBody = joinText(
    "It's your turn",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your table is ready at ${restaurant}.`,
    `Token: ${token}`,
    "",
    "Please proceed to the host stand.",
    `View queue status: ${url}`,
  );

  return renderEmail({
    subject: `It's your turn at ${restaurant}`,
    badge: "Queue",
    preheader: `Token ${token} — please proceed to the host stand`,
    htmlBody,
    textBody,
  });
}

export function renderQueueReminderEmail(
  data: QueueEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const token = safeValue(data.token, "—");
  const url = statusUrl(data);

  const htmlBody = [
    emailStatusHtml({ tone: "WARNING", label: "Getting close" }),
    emailHeadingHtml("You're getting close"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `You're getting closer to your table at ${restaurant}. Please keep your phone nearby.`,
    ),
    emailCardHtml({
      accent: "warning",
      children: emailInfoTableHtml([
        { label: "Token", value: token },
        { label: "Position", value: data.position },
        { label: "Estimated wait", value: data.estimatedWait ?? "unavailable" },
      ]),
    }),
    emailButtonHtml({
      href: url,
      label: "View Queue Status",
      variant: "primary",
    }),
  ].join("");

  const textBody = joinText(
    "You're getting close",
    "",
    emailGreetingText(data.customerName),
    "",
    `You're getting closer to your table at ${restaurant}.`,
    `Token: ${token}`,
    `Position: ${safeValue(data.position)}`,
    `Estimated wait: ${safeValue(data.estimatedWait, "unavailable")}`,
    "",
    "Please keep your phone nearby.",
    `View queue status: ${url}`,
  );

  return renderEmail({
    subject: `Queue update — ${restaurant}`,
    badge: "Queue",
    preheader: `You're almost up · token ${token}`,
    htmlBody,
    textBody,
  });
}

export function renderQueueReadyEmail(data: QueueEmailData): EmailRenderResult {
  // Same guest-facing urgency as called; keep subject distinct if needed.
  const rendered = renderQueueCalledEmail(data);
  return {
    ...rendered,
    subject: `Your table is ready — ${restaurantLabel(data)}`,
  };
}

export function renderQueueSeatedEmail(data: QueueEmailData): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const token = safeValue(data.token, "—");

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Seated" }),
    emailHeadingHtml("You're seated"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(`Enjoy your experience at ${restaurant}.`),
    emailCardHtml({
      accent: "success",
      children: emailInfoTableHtml([
        { label: "Token", value: token },
        { label: "Table", value: data.tableName },
        { label: "Party size", value: data.partySize },
      ]),
    }),
    emailParagraphHtml("Thank you for choosing us.", { muted: true }),
  ].join("");

  const textBody = joinText(
    "You're seated",
    "",
    emailGreetingText(data.customerName),
    "",
    `Enjoy your experience at ${restaurant}.`,
    `Token: ${token}`,
    `Table: ${safeValue(data.tableName)}`,
    `Party size: ${safeValue(data.partySize)}`,
    "",
    "Thank you for choosing us.",
  );

  return renderEmail({
    subject: `You're seated — ${restaurant}`,
    badge: "Queue",
    preheader: `Enjoy your visit at ${restaurant}`,
    htmlBody,
    textBody,
  });
}

export function renderQueueCancelledEmail(
  data: QueueEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const token = safeValue(data.token, "—");

  const htmlBody = [
    emailStatusHtml({ tone: "ERROR", label: "Cancelled" }),
    emailHeadingHtml("Queue entry cancelled"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `Your queue entry at ${restaurant} has been cancelled.`,
    ),
    emailCardHtml({
      children: emailInfoTableHtml([{ label: "Token", value: token }]),
    }),
    emailParagraphHtml(
      "If you believe this was a mistake, please contact the restaurant.",
      { muted: true },
    ),
  ].join("");

  const textBody = joinText(
    "Queue entry cancelled",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your queue entry at ${restaurant} has been cancelled.`,
    `Token: ${token}`,
    "",
    "If you believe this was a mistake, please contact the restaurant.",
  );

  return renderEmail({
    subject: `Queue update — ${restaurant}`,
    badge: "Queue",
    preheader: `Token ${token} was cancelled`,
    htmlBody,
    textBody,
  });
}

export function renderQueueNoShowEmail(data: QueueEmailData): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const token = safeValue(data.token, "—");

  const htmlBody = [
    emailStatusHtml({ tone: "WARNING", label: "No-show" }),
    emailHeadingHtml("Queue update"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `We couldn't confirm your arrival for token ${token} at ${restaurant}.`,
    ),
    emailParagraphHtml(
      "Your queue entry has been marked as no-show. Please contact the restaurant if you need assistance.",
    ),
  ].join("");

  const textBody = joinText(
    "Queue update",
    "",
    emailGreetingText(data.customerName),
    "",
    `We couldn't confirm your arrival for token ${token} at ${restaurant}.`,
    "Your queue entry has been marked as no-show.",
    "Please contact the restaurant if you need assistance.",
  );

  return renderEmail({
    subject: `Queue update — ${restaurant}`,
    badge: "Queue",
    preheader: `Token ${token} marked as no-show`,
    htmlBody,
    textBody,
  });
}
