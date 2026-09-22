import {
  EMAIL_RADIUS,
  EMAIL_STATUS_STYLES,
  EMAIL_TYPOGRAPHY,
  type EmailStatusTone,
} from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";

export function emailStatusHtml(opts: {
  tone: EmailStatusTone;
  label?: string;
}): string {
  const style = EMAIL_STATUS_STYLES[opts.tone];
  const label = escapeHtml(opts.label ?? style.label);

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
  <tr>
    <td style="background-color:${style.bg};border:1px solid ${style.border};border-radius:${EMAIL_RADIUS.badge};padding:6px 12px;">
      <span class="email-status-dot" style="display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:50%;background:${style.color};color:#fff;font-size:11px;font-weight:700;font-family:${EMAIL_TYPOGRAPHY.fontFamily};vertical-align:middle;">${style.icon}</span>
      <span style="display:inline-block;padding-left:8px;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${style.color};vertical-align:middle;">${label}</span>
    </td>
  </tr>
</table>`.trim();
}

export function emailBadgeHtml(opts: {
  label: string;
  tone?: EmailStatusTone;
}): string {
  const tone = opts.tone ?? "NEUTRAL";
  const style = EMAIL_STATUS_STYLES[tone];
  return `<span style="display:inline-block;padding:5px 12px;border-radius:${EMAIL_RADIUS.badge};background:${style.bg};border:1px solid ${style.border};font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${style.color};">${escapeHtml(opts.label)}</span>`;
}
