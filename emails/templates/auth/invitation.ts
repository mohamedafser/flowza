import {
  emailBadgeHtml,
  emailButtonHtml,
  emailCardHtml,
  emailHeadingHtml,
  emailInfoTableHtml,
  emailParagraphHtml,
} from "@/emails/components";
import { EMAIL_BRAND } from "@/emails/theme";
import {
  absoluteUrl,
  escapeHtml,
  formatDisplayDate,
  safeName,
  safeValue,
} from "@/emails/utils/personalize";
import { renderEmail } from "@/emails/utils/render";
import type { EmailRenderResult } from "@/emails/utils/types";
import { joinText } from "@/emails/utils/types";
import { MEMBER_ROLE_LABELS } from "@/lib/utils/members";
import type { MemberRole } from "@/lib/auth/roles";
import { SIGNUP_PATH } from "@/lib/auth/paths";

export function renderInvitationEmail(input: {
  to: string;
  restaurantName: string;
  role: MemberRole;
  inviterName?: string | null;
  invitationId: string;
  expiresAt?: string | null;
}): EmailRenderResult {
  const roleLabel = MEMBER_ROLE_LABELS[input.role];
  const restaurant = safeValue(input.restaurantName, "your team");
  const inviter = safeName(input.inviterName, "");
  const inviterLine = inviter
    ? `${inviter} invited you to join`
    : "You've been invited to join";

  const signupUrl = new URL(SIGNUP_PATH, `${EMAIL_BRAND.appUrl}/`);
  signupUrl.searchParams.set("email", input.to);
  signupUrl.searchParams.set("invite", input.invitationId);
  const actionUrl = absoluteUrl(signupUrl.toString());
  const expiresLabel = input.expiresAt
    ? formatDisplayDate(input.expiresAt)
    : null;

  const htmlBody = [
    emailHeadingHtml("You're invited"),
    emailParagraphHtml(`${inviterLine}`, { muted: true }),
    `<p class="email-text" style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F172A;">${escapeHtml(restaurant)}</p>`,
    emailParagraphHtml("as", { muted: true, marginBottom: "8px" }),
    `<p style="margin:0 0 16px;">${emailBadgeHtml({ label: roleLabel, tone: "INFO" })}</p>`,
    emailCardHtml({
      accent: "info",
      children: emailInfoTableHtml([
        { label: "Restaurant", value: restaurant },
        { label: "Role", value: roleLabel },
        { label: "Email", value: input.to },
        ...(expiresLabel
          ? [{ label: "Expires", value: expiresLabel }]
          : []),
      ]),
    }),
    emailParagraphHtml(
      "Create your account with this email address. After signup, we'll send a 6-digit code to verify your address.",
    ),
    emailButtonHtml({
      href: actionUrl,
      label: "Accept Invitation",
      variant: "primary",
    }),
    expiresLabel
      ? emailParagraphHtml(`This invitation expires on ${expiresLabel}.`, {
          muted: true,
        })
      : "",
  ].join("");

  const textBody = joinText(
    "You're invited",
    "",
    `${inviterLine} ${restaurant} on ${EMAIL_BRAND.name} as ${roleLabel}.`,
    "",
    `Restaurant: ${restaurant}`,
    `Role: ${roleLabel}`,
    `Email: ${input.to}`,
    expiresLabel ? `Expires: ${expiresLabel}` : null,
    "",
    "Create your account with this email address, then enter the 6-digit verification code we'll send you:",
    actionUrl,
    "",
    `This invitation is only valid for ${input.to}.`,
  );

  return renderEmail({
    subject: `You're invited to join ${restaurant}`,
    badge: "Invitation",
    preheader: `${inviterLine} ${restaurant}`,
    htmlBody,
    textBody,
  });
}
