import {
  EMAIL_BRAND,
  EMAIL_COLORS,
  EMAIL_RADIUS,
  EMAIL_SPACING,
  EMAIL_TYPOGRAPHY,
} from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";
import type { EmailTemplateDefinition } from "@/emails/utils/types";
import { textFooter } from "@/emails/utils/types";
import { emailFooterHtml } from "@/emails/components/footer";
import { emailHeaderHtml } from "@/emails/components/header";

/**
 * Progressive-enhancement animation styles.
 * Meaning must never depend on these — static styles always apply.
 */
function animationStyles(): string {
  return `
@keyframes emailFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes emailPulseSoft {
  0%, 100% { box-shadow: 0 0 0 0 rgba(15, 23, 42, 0.08); }
  50% { box-shadow: 0 0 0 6px rgba(15, 23, 42, 0); }
}
@keyframes emailStatusGlow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.72; }
}
@media (prefers-reduced-motion: no-preference) {
  .email-fade { animation: emailFadeIn 0.45s ease-out both; }
  .email-otp { animation: emailPulseSoft 2.8s ease-in-out 1; }
  .email-status-dot { animation: emailStatusGlow 2s ease-in-out infinite; }
}
`.trim();
}

export function renderEmailHtml(definition: EmailTemplateDefinition): string {
  const preheader = escapeHtml(
    definition.preheader || definition.previewText || definition.subject,
  );
  const title = escapeHtml(definition.subject);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    ${animationStyles()}
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .email-card { padding: 24px 18px !important; }
      .email-btn a { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .email-otp-code { font-size: 28px !important; letter-spacing: 0.2em !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-body-bg { background-color: #0B1220 !important; }
      .email-card-bg { background-color: #111827 !important; border-color: #1F2937 !important; }
      .email-text { color: #E5E7EB !important; }
      .email-muted { color: #9CA3AF !important; }
    }
  </style>
</head>
<body class="email-body-bg" style="margin:0;padding:0;background-color:${EMAIL_COLORS.background};font-family:${EMAIL_TYPOGRAPHY.fontFamily};color:${EMAIL_COLORS.text};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${preheader}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-body-bg" style="background-color:${EMAIL_COLORS.background};">
    <tr>
      <td align="center" style="padding:${EMAIL_SPACING.page};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" class="email-container" style="width:560px;max-width:560px;">
          <tr>
            <td class="email-fade">
              ${emailHeaderHtml({ badge: definition.badge })}
            </td>
          </tr>
          <tr>
            <td class="email-card-bg email-card email-fade" style="background-color:${EMAIL_COLORS.card};border:1px solid ${EMAIL_COLORS.border};border-radius:${EMAIL_RADIUS.card};padding:${EMAIL_SPACING.card};">
              ${definition.htmlBody}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;">
              ${emailFooterHtml()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailText(definition: EmailTemplateDefinition): string {
  return `${definition.textBody}\n\n${textFooter()}`.trim();
}

export function renderEmail(
  definition: EmailTemplateDefinition,
): { subject: string; html: string; text: string } {
  return {
    subject: definition.subject,
    html: renderEmailHtml(definition),
    text: renderEmailText(definition),
  };
}

export function brandSubject(parts: string[]): string {
  return parts.filter(Boolean).join(" — ");
}

export { EMAIL_BRAND };
