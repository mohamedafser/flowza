import {
  emailAlertHtml,
  emailButtonHtml,
  emailHeadingHtml,
  emailParagraphHtml,
  emailStatusHtml,
} from "@/emails/components";
import { EMAIL_BRAND } from "@/emails/theme";
import { absoluteUrl } from "@/emails/utils/personalize";
import { renderEmail } from "@/emails/utils/render";
import type { EmailRenderResult } from "@/emails/utils/types";
import { joinText } from "@/emails/utils/types";
import { LOGIN_PATH } from "@/lib/auth/paths";

export function renderPasswordResetSuccessEmail(input?: {
  actionUrl?: string;
  supportUrl?: string;
}): EmailRenderResult {
  const supportUrl =
    input?.supportUrl ?? `mailto:${EMAIL_BRAND.supportEmail}`;
  const loginUrl = input?.actionUrl ?? absoluteUrl(LOGIN_PATH);

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Password updated" }),
    emailHeadingHtml("Your password was changed"),
    emailParagraphHtml(
      "Your password has been successfully updated. You can now sign in with your new password.",
    ),
    emailButtonHtml({
      href: loginUrl,
      label: "Sign In",
      variant: "primary",
    }),
    emailAlertHtml({
      tone: "ERROR",
      title: "Didn't make this change?",
      body: "If you did not change your password, contact support immediately.",
    }),
    emailButtonHtml({
      href: supportUrl,
      label: "Contact Support",
      variant: "secondary",
    }),
  ].join("");

  const textBody = joinText(
    "Your password was changed",
    "",
    "Your password has been successfully updated.",
    `Sign in: ${loginUrl}`,
    "",
    "If you did not make this change, contact support immediately.",
    `Support: ${EMAIL_BRAND.supportEmail}`,
  );

  return renderEmail({
    subject: `Your password was changed — ${EMAIL_BRAND.name}`,
    badge: "Account security",
    preheader: "Your password has been updated",
    htmlBody,
    textBody,
  });
}
