import {
  emailButtonHtml,
  emailGreetingHtml,
  emailGreetingText,
  emailHeadingHtml,
  emailOtpHtml,
  emailParagraphHtml,
  emailSecurityNoticeHtml,
} from "@/emails/components";
import { EMAIL_BRAND } from "@/emails/theme";
import {
  absoluteUrl,
  formatExpiryMinutes,
} from "@/emails/utils/personalize";
import { renderEmail } from "@/emails/utils/render";
import type { EmailRenderResult } from "@/emails/utils/types";
import { joinText } from "@/emails/utils/types";
import { VERIFY_RESET_OTP_PATH } from "@/lib/auth/paths";

export function renderForgotPasswordOtpEmail(input: {
  fullName?: string | null;
  code: string;
  expiryMinutes: number;
  actionUrl?: string;
}): EmailRenderResult {
  const expiry = formatExpiryMinutes(input.expiryMinutes);
  const actionUrl = input.actionUrl ?? absoluteUrl(VERIFY_RESET_OTP_PATH);

  const htmlBody = [
    emailHeadingHtml("Reset your password"),
    emailGreetingHtml(input.fullName),
    emailParagraphHtml(
      "We received a request to reset your password. Use the verification code below to continue.",
    ),
    emailOtpHtml({ code: input.code, expiryMinutes: input.expiryMinutes }),
    emailButtonHtml({
      href: actionUrl,
      label: "Reset Password",
      variant: "primary",
    }),
    emailSecurityNoticeHtml({
      title: "Didn't request this?",
      body: "If you did not request a password reset, no action is required. Your password will stay the same.",
    }),
  ].join("");

  const textBody = joinText(
    "Reset your password",
    "",
    emailGreetingText(input.fullName),
    "",
    "We received a request to reset your password.",
    `Your verification code is ${input.code}.`,
    `This code expires in ${expiry}.`,
    "",
    `Continue: ${actionUrl}`,
    "",
    "If you did not request a password reset, no action is required.",
  );

  return renderEmail({
    subject: `Your password reset code — ${EMAIL_BRAND.name}`,
    badge: "Account security",
    preheader: "Use this code to reset your password",
    htmlBody,
    textBody,
  });
}
