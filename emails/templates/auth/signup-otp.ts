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
import { VERIFY_EMAIL_PATH } from "@/lib/auth/paths";

export function renderSignupOtpEmail(input: {
  fullName?: string | null;
  code: string;
  expiryMinutes: number;
  actionUrl?: string;
}): EmailRenderResult {
  const expiry = formatExpiryMinutes(input.expiryMinutes);
  const actionUrl = input.actionUrl ?? absoluteUrl(VERIFY_EMAIL_PATH);

  const htmlBody = [
    emailHeadingHtml(`Welcome to ${EMAIL_BRAND.name}`),
    emailParagraphHtml("Let's verify your email.", { muted: true }),
    emailGreetingHtml(input.fullName),
    emailParagraphHtml(
      "Thanks for creating your account. Use the verification code below to verify your email address.",
    ),
    emailOtpHtml({ code: input.code, expiryMinutes: input.expiryMinutes }),
    emailButtonHtml({
      href: actionUrl,
      label: "Verify Email",
      variant: "primary",
    }),
    emailSecurityNoticeHtml({
      body: "Never share this code with anyone. If you did not create an account, you can safely ignore this email.",
    }),
  ].join("");

  const textBody = joinText(
    `Welcome to ${EMAIL_BRAND.name}`,
    "",
    emailGreetingText(input.fullName),
    "",
    "Thanks for creating your account.",
    `Your verification code is ${input.code}.`,
    `This code expires in ${expiry}.`,
    "",
    `Verify your email: ${actionUrl}`,
    "",
    "Never share this code with anyone.",
    "If you did not create an account, you can safely ignore this email.",
  );

  return renderEmail({
    subject: `Verify your email — ${EMAIL_BRAND.name}`,
    badge: "Account security",
    preheader: `Your ${EMAIL_BRAND.name} verification code`,
    htmlBody,
    textBody,
  });
}
