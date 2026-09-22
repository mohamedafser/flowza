import type { EmailRenderResult } from "@/emails/utils/types";
import {
  renderEmailVerificationSuccessEmail,
  renderForgotPasswordOtpEmail,
  renderInvitationEmail,
  renderPasswordResetSuccessEmail,
  renderSignupOtpEmail,
} from "@/emails/templates/auth";
import {
  renderNotificationEmail,
  renderReservationUpdatedEmail,
  type NotificationEmailData,
} from "@/emails/templates/notifications";
import type { NotificationType } from "@/lib/notifications/types";

export type EmailPreviewId =
  | "signup-otp"
  | "forgot-password-otp"
  | "invitation"
  | "password-reset-success"
  | "email-verification-success"
  | "queue-joined"
  | "queue-called"
  | "queue-reminder"
  | "queue-ready"
  | "queue-seated"
  | "queue-cancelled"
  | "queue-no-show"
  | "reservation-confirmation"
  | "reservation-reminder"
  | "reservation-cancelled"
  | "reservation-updated"
  | "reservation-created";

const SAMPLE_QUEUE: NotificationEmailData = {
  customerName: "Ada Lovelace",
  restaurantName: "Harbor Kitchen",
  branchName: "Downtown",
  token: "A024",
  partySize: 4,
  estimatedWait: "25 min",
  position: 6,
  queueName: "Main Queue",
  tableName: "12",
};

const SAMPLE_RESERVATION: NotificationEmailData = {
  customerName: "Ada Lovelace",
  restaurantName: "Harbor Kitchen",
  branchName: "Downtown",
  reservationCode: "RES-10482",
  partySize: 4,
  reservationDate: "September 28, 2026",
  reservationTime: "7:30 PM",
  tableName: "Patio 4",
};

const PREVIEW_NOTIFICATION_MAP: Partial<
  Record<EmailPreviewId, NotificationType>
> = {
  "queue-joined": "QUEUE_JOINED",
  "queue-called": "QUEUE_CALLED",
  "queue-reminder": "QUEUE_REMINDER",
  "queue-ready": "QUEUE_READY",
  "queue-seated": "QUEUE_SEATED",
  "queue-cancelled": "QUEUE_CANCELLED",
  "queue-no-show": "QUEUE_NO_SHOW",
  "reservation-confirmation": "RESERVATION_CONFIRMED",
  "reservation-reminder": "RESERVATION_REMINDER",
  "reservation-cancelled": "RESERVATION_CANCELLED",
  "reservation-created": "RESERVATION_CREATED",
};

export const EMAIL_PREVIEW_IDS: EmailPreviewId[] = [
  "signup-otp",
  "forgot-password-otp",
  "invitation",
  "password-reset-success",
  "email-verification-success",
  "queue-joined",
  "queue-called",
  "queue-reminder",
  "queue-ready",
  "queue-seated",
  "queue-cancelled",
  "queue-no-show",
  "reservation-created",
  "reservation-confirmation",
  "reservation-reminder",
  "reservation-cancelled",
  "reservation-updated",
];

export function renderEmailPreview(id: EmailPreviewId): EmailRenderResult {
  switch (id) {
    case "signup-otp":
      return renderSignupOtpEmail({
        fullName: "Ada Lovelace",
        code: "482176",
        expiryMinutes: 5,
      });
    case "forgot-password-otp":
      return renderForgotPasswordOtpEmail({
        fullName: "Ada Lovelace",
        code: "391048",
        expiryMinutes: 5,
      });
    case "invitation":
      return renderInvitationEmail({
        to: "ada@example.com",
        restaurantName: "Harbor Kitchen",
        role: "MANAGER",
        inviterName: "Grace Hopper",
        invitationId: "00000000-0000-4000-8000-000000000001",
        expiresAt: "2026-10-05T12:00:00.000Z",
      });
    case "password-reset-success":
      return renderPasswordResetSuccessEmail();
    case "email-verification-success":
      return renderEmailVerificationSuccessEmail();
    case "reservation-updated":
      return renderReservationUpdatedEmail({
        ...SAMPLE_RESERVATION,
        reservationTime: "8:00 PM",
      });
    default: {
      const type = PREVIEW_NOTIFICATION_MAP[id];
      if (!type) {
        throw new Error(`Unknown email preview id: ${id}`);
      }
      const data = type.startsWith("RESERVATION_")
        ? SAMPLE_RESERVATION
        : SAMPLE_QUEUE;
      return renderNotificationEmail(type, data);
    }
  }
}
