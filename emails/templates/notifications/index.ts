import {
  emailCardHtml,
  emailHeadingHtml,
  emailInfoTableHtml,
  emailParagraphHtml,
  emailStatusHtml,
} from "@/emails/components";
import { safeValue } from "@/emails/utils/personalize";
import { renderEmail } from "@/emails/utils/render";
import type { EmailRenderResult } from "@/emails/utils/types";
import { joinText } from "@/emails/utils/types";
import type { NotificationType } from "@/lib/notifications/types";
import {
  renderQueueCalledEmail,
  renderQueueCancelledEmail,
  renderQueueJoinedEmail,
  renderQueueNoShowEmail,
  renderQueueReadyEmail,
  renderQueueReminderEmail,
  renderQueueSeatedEmail,
  type QueueEmailData,
} from "@/emails/templates/notifications/queue";
import {
  renderReservationArrivedEmail,
  renderReservationCancelledEmail,
  renderReservationConfirmationEmail,
  renderReservationCreatedEmail,
  renderReservationNoShowEmail,
  renderReservationReminderEmail,
  renderReservationSeatedEmail,
  renderReservationUpdatedEmail,
  type ReservationEmailData,
} from "@/emails/templates/notifications/reservation";

export type NotificationEmailData = QueueEmailData &
  ReservationEmailData &
  Record<string, string | number | null | undefined>;

function renderStaffOpsEmail(
  type: NotificationType,
  data: NotificationEmailData,
): EmailRenderResult {
  const title = type.replaceAll("_", " ");
  const restaurant = safeValue(data.restaurantName, "Restaurant");

  const htmlBody = [
    emailStatusHtml({ tone: "INFO", label: "Staff alert" }),
    emailHeadingHtml(title),
    emailParagraphHtml("A staff-facing queue or reservation update occurred."),
    emailCardHtml({
      children: emailInfoTableHtml([
        { label: "Guest", value: data.customerName },
        { label: "Restaurant", value: restaurant },
        { label: "Branch", value: data.branchName },
        { label: "Token / code", value: data.token ?? data.reservationCode },
        { label: "Party", value: data.partySize },
        { label: "Queue", value: data.queueName },
      ]),
    }),
  ].join("");

  const textBody = joinText(
    title,
    "",
    `Guest: ${safeValue(data.customerName)}`,
    `Restaurant: ${restaurant}`,
    `Branch: ${safeValue(data.branchName)}`,
    `Token / code: ${safeValue(data.token ?? data.reservationCode)}`,
    `Party: ${safeValue(data.partySize)}`,
  );

  return renderEmail({
    subject: `${title} — ${restaurant}`,
    badge: "Staff",
    preheader: title,
    htmlBody,
    textBody,
  });
}

/**
 * Rich HTML + plain-text email for customer (and staff) notification types.
 * SMS / WhatsApp / in-app continue to use `lib/notifications/templates`.
 */
export function renderNotificationEmail(
  type: NotificationType,
  data: NotificationEmailData,
): EmailRenderResult {
  switch (type) {
    case "QUEUE_JOINED":
      return renderQueueJoinedEmail(data);
    case "QUEUE_CALLED":
      return renderQueueCalledEmail(data);
    case "QUEUE_REMINDER":
      return renderQueueReminderEmail(data);
    case "QUEUE_READY":
      return renderQueueReadyEmail(data);
    case "QUEUE_SEATED":
      return renderQueueSeatedEmail(data);
    case "QUEUE_CANCELLED":
      return renderQueueCancelledEmail(data);
    case "QUEUE_NO_SHOW":
      return renderQueueNoShowEmail(data);
    case "RESERVATION_CREATED":
      return renderReservationCreatedEmail(data);
    case "RESERVATION_CONFIRMED":
      return renderReservationConfirmationEmail(data);
    case "RESERVATION_REMINDER":
      return renderReservationReminderEmail(data);
    case "RESERVATION_CANCELLED":
      return renderReservationCancelledEmail(data);
    case "RESERVATION_ARRIVED":
      return renderReservationArrivedEmail(data);
    case "RESERVATION_SEATED":
      return renderReservationSeatedEmail(data);
    case "RESERVATION_NO_SHOW":
      return renderReservationNoShowEmail(data);
    default:
      if (type.startsWith("STAFF_")) {
        return renderStaffOpsEmail(type, data);
      }
      // Future types / updates fall back to a clear transactional shell.
      return renderReservationUpdatedEmail(data);
  }
}

export {
  renderQueueJoinedEmail,
  renderQueueCalledEmail,
  renderQueueReminderEmail,
  renderQueueReadyEmail,
  renderQueueSeatedEmail,
  renderQueueCancelledEmail,
  renderQueueNoShowEmail,
  renderReservationCreatedEmail,
  renderReservationConfirmationEmail,
  renderReservationReminderEmail,
  renderReservationCancelledEmail,
  renderReservationUpdatedEmail,
  renderReservationArrivedEmail,
  renderReservationSeatedEmail,
  renderReservationNoShowEmail,
};
