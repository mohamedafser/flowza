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
import {
  absoluteUrl,
  safeValue,
} from "@/emails/utils/personalize";
import { renderEmail } from "@/emails/utils/render";
import type { EmailRenderResult } from "@/emails/utils/types";
import { joinText } from "@/emails/utils/types";
import { DASHBOARD_RESERVATIONS_PATH } from "@/lib/auth/paths";

export type ReservationEmailData = {
  customerName?: string | null;
  restaurantName?: string | null;
  branchName?: string | null;
  reservationCode?: string | null;
  token?: string | null;
  partySize?: string | number | null;
  reservationDate?: string | null;
  reservationTime?: string | null;
  tableName?: string | null;
  actionUrl?: string | null;
};

function restaurantLabel(data: ReservationEmailData): string {
  return safeValue(data.restaurantName, "the restaurant");
}

function codeOf(data: ReservationEmailData): string {
  return safeValue(data.reservationCode ?? data.token, "—");
}

function viewUrl(data: ReservationEmailData): string {
  return data.actionUrl?.trim() || absoluteUrl(DASHBOARD_RESERVATIONS_PATH);
}

function detailsCard(data: ReservationEmailData) {
  return emailCardHtml({
    children: emailInfoTableHtml([
      { label: "Reservation", value: codeOf(data) },
      { label: "Date", value: data.reservationDate },
      { label: "Time", value: data.reservationTime },
      { label: "Guests", value: data.partySize },
      { label: "Table", value: data.tableName },
      ...(data.branchName
        ? [{ label: "Location", value: data.branchName }]
        : []),
    ]),
  });
}

export function renderReservationConfirmationEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const url = viewUrl(data);

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Confirmed" }),
    emailHeadingHtml("Reservation confirmed"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(`Your reservation is confirmed at ${restaurant}.`),
    detailsCard(data),
    emailButtonHtml({
      href: url,
      label: "View Reservation",
      variant: "primary",
    }),
  ].join("");

  const textBody = joinText(
    "Reservation confirmed",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your reservation is confirmed at ${restaurant}.`,
    `Code: ${codeOf(data)}`,
    `Date: ${safeValue(data.reservationDate)}`,
    `Time: ${safeValue(data.reservationTime)}`,
    `Guests: ${safeValue(data.partySize)}`,
    `Table: ${safeValue(data.tableName)}`,
    "",
    `View reservation: ${url}`,
  );

  return renderEmail({
    subject: `Your reservation is confirmed — ${restaurant}`,
    badge: "Reservation",
    preheader: `${safeValue(data.reservationDate)} · ${safeValue(data.reservationTime)}`,
    htmlBody,
    textBody,
  });
}

export function renderReservationCreatedEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const url = viewUrl(data);

  const htmlBody = [
    emailStatusHtml({ tone: "INFO", label: "Received" }),
    emailHeadingHtml("Reservation received"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `Your reservation at ${restaurant} has been recorded.`,
    ),
    detailsCard(data),
    emailButtonHtml({
      href: url,
      label: "View Reservation",
      variant: "primary",
    }),
  ].join("");

  const textBody = joinText(
    "Reservation received",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your reservation at ${restaurant} has been recorded.`,
    `Code: ${codeOf(data)}`,
    `Date: ${safeValue(data.reservationDate)}`,
    `Time: ${safeValue(data.reservationTime)}`,
    `Guests: ${safeValue(data.partySize)}`,
    "",
    `View reservation: ${url}`,
  );

  return renderEmail({
    subject: `Reservation ${codeOf(data)} — ${restaurant}`,
    badge: "Reservation",
    preheader: "Your reservation has been recorded",
    htmlBody,
    textBody,
  });
}

export function renderReservationReminderEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const url = viewUrl(data);
  const when = [
    safeValue(data.reservationTime, ""),
    data.partySize != null ? `${safeValue(data.partySize)} guests` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const htmlBody = [
    emailStatusHtml({ tone: "WARNING", label: "Reminder" }),
    emailHeadingHtml("Your reservation is coming up"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `Your reservation at ${restaurant} is scheduled for ${safeValue(data.reservationDate)}${when ? ` · ${when}` : ""}.`,
    ),
    detailsCard(data),
    emailButtonHtml({
      href: url,
      label: "View Reservation",
      variant: "primary",
    }),
  ].join("");

  const textBody = joinText(
    "Your reservation is coming up",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your reservation at ${restaurant} is scheduled for ${safeValue(data.reservationDate)}.`,
    when,
    `Code: ${codeOf(data)}`,
    "",
    `View reservation: ${url}`,
  );

  return renderEmail({
    subject: "Your reservation is coming up",
    badge: "Reservation",
    preheader: `${restaurant} · ${safeValue(data.reservationDate)}`,
    htmlBody,
    textBody,
  });
}

export function renderReservationCancelledEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);

  const htmlBody = [
    emailStatusHtml({ tone: "ERROR", label: "Cancelled" }),
    emailHeadingHtml("Reservation cancelled"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(`Your reservation has been cancelled at ${restaurant}.`),
    detailsCard(data),
  ].join("");

  const textBody = joinText(
    "Reservation cancelled",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your reservation has been cancelled at ${restaurant}.`,
    `Reservation: ${codeOf(data)}`,
    `Date: ${safeValue(data.reservationDate)}`,
    `Time: ${safeValue(data.reservationTime)}`,
  );

  return renderEmail({
    subject: `Reservation cancelled — ${restaurant}`,
    badge: "Reservation",
    preheader: `Reservation ${codeOf(data)} cancelled`,
    htmlBody,
    textBody,
  });
}

export function renderReservationUpdatedEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);
  const url = viewUrl(data);

  const htmlBody = [
    emailStatusHtml({ tone: "INFO", label: "Updated" }),
    emailHeadingHtml("Reservation updated"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `Your reservation details at ${restaurant} have been updated.`,
    ),
    detailsCard(data),
    emailButtonHtml({
      href: url,
      label: "View Reservation",
      variant: "primary",
    }),
  ].join("");

  const textBody = joinText(
    "Reservation updated",
    "",
    emailGreetingText(data.customerName),
    "",
    `Your reservation details at ${restaurant} have been updated.`,
    `Code: ${codeOf(data)}`,
    `Date: ${safeValue(data.reservationDate)}`,
    `Time: ${safeValue(data.reservationTime)}`,
    `Guests: ${safeValue(data.partySize)}`,
    "",
    `View reservation: ${url}`,
  );

  return renderEmail({
    subject: `Reservation updated — ${restaurant}`,
    badge: "Reservation",
    preheader: "Your reservation details changed",
    htmlBody,
    textBody,
  });
}

export function renderReservationArrivedEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Checked in" }),
    emailHeadingHtml("You're checked in"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `You've been checked in for reservation ${codeOf(data)} at ${restaurant}.`,
    ),
    detailsCard(data),
  ].join("");

  const textBody = joinText(
    "You're checked in",
    "",
    emailGreetingText(data.customerName),
    "",
    `You've been checked in for reservation ${codeOf(data)} at ${restaurant}.`,
  );

  return renderEmail({
    subject: `Checked in — ${restaurant}`,
    badge: "Reservation",
    preheader: "You've been checked in",
    htmlBody,
    textBody,
  });
}

export function renderReservationSeatedEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Seated" }),
    emailHeadingHtml("You're seated"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `You've been seated at ${restaurant}${data.tableName ? ` (${safeValue(data.tableName)})` : ""}. Enjoy!`,
    ),
  ].join("");

  const textBody = joinText(
    "You're seated",
    "",
    emailGreetingText(data.customerName),
    "",
    `You've been seated at ${restaurant}. Enjoy!`,
  );

  return renderEmail({
    subject: `Seated — ${restaurant}`,
    badge: "Reservation",
    preheader: "Enjoy your visit",
    htmlBody,
    textBody,
  });
}

export function renderReservationNoShowEmail(
  data: ReservationEmailData,
): EmailRenderResult {
  const restaurant = restaurantLabel(data);

  const htmlBody = [
    emailStatusHtml({ tone: "WARNING", label: "No-show" }),
    emailHeadingHtml("Reservation marked no-show"),
    emailGreetingHtml(data.customerName, "there"),
    emailParagraphHtml(
      `Reservation ${codeOf(data)} at ${restaurant} was marked as no-show.`,
    ),
    emailParagraphHtml(
      "Please contact the restaurant if you need assistance.",
      { muted: true },
    ),
  ].join("");

  const textBody = joinText(
    "Reservation marked no-show",
    "",
    emailGreetingText(data.customerName),
    "",
    `Reservation ${codeOf(data)} at ${restaurant} was marked as no-show.`,
    "Please contact the restaurant if you need assistance.",
  );

  return renderEmail({
    subject: `Reservation update — ${restaurant}`,
    badge: "Reservation",
    preheader: `Reservation ${codeOf(data)} marked no-show`,
    htmlBody,
    textBody,
  });
}
