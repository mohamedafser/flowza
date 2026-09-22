import {
  EMAIL_COLORS,
  EMAIL_RADIUS,
  EMAIL_STATUS_STYLES,
  EMAIL_TYPOGRAPHY,
  type EmailStatusTone,
} from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";

export function emailAlertHtml(opts: {
  tone: EmailStatusTone;
  title?: string;
  body: string;
}): string {
  const style = EMAIL_STATUS_STYLES[opts.tone];
  const title = opts.title
    ? `<p style="margin:0 0 4px;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:13px;font-weight:700;color:${style.color};">${escapeHtml(opts.title)}</p>`
    : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 4px;">
  <tr>
    <td style="background-color:${style.bg};border:1px solid ${style.border};border-left:4px solid ${style.color};border-radius:${EMAIL_RADIUS.inner};padding:14px 16px;">
      ${title}
      <p class="email-muted" style="margin:0;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.smallSize};line-height:1.5;color:${EMAIL_COLORS.textMuted};">${escapeHtml(opts.body)}</p>
    </td>
  </tr>
</table>`.trim();
}
