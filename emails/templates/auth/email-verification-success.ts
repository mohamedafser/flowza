import {
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
import { DASHBOARD_OVERVIEW_PATH } from "@/lib/auth/paths";

export function renderEmailVerificationSuccessEmail(input?: {
  actionUrl?: string;
}): EmailRenderResult {
  const dashboardUrl =
    input?.actionUrl ?? absoluteUrl(DASHBOARD_OVERVIEW_PATH);

  const htmlBody = [
    emailStatusHtml({ tone: "SUCCESS", label: "Verified" }),
    emailHeadingHtml("Email verified successfully"),
    emailParagraphHtml(
      `Your email address has been verified. You're ready to continue using ${EMAIL_BRAND.name}.`,
    ),
    emailButtonHtml({
      href: dashboardUrl,
      label: "Open Dashboard",
      variant: "success",
    }),
  ].join("");

  const textBody = joinText(
    "Email verified successfully",
    "",
    `Your email address has been verified. You're ready to continue using ${EMAIL_BRAND.name}.`,
    "",
    `Open dashboard: ${dashboardUrl}`,
  );

  return renderEmail({
    subject: `Email verified — ${EMAIL_BRAND.name}`,
    badge: "Account",
    preheader: "Your email address has been verified",
    htmlBody,
    textBody,
  });
}
