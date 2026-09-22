import {
  EMAIL_COLORS,
  EMAIL_RADIUS,
  EMAIL_TYPOGRAPHY,
} from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";
import { emailLogoHtml } from "@/emails/components/logo";

export function emailHeaderHtml(opts?: { badge?: string }): string {
  const badge = opts?.badge?.trim();
  const badgeHtml = badge
    ? `<span style="display:inline-block;margin-left:10px;padding:4px 10px;border-radius:${EMAIL_RADIUS.badge};background:${EMAIL_COLORS.borderSoft};border:1px solid ${EMAIL_COLORS.border};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted};font-family:${EMAIL_TYPOGRAPHY.fontFamily};">${escapeHtml(badge)}</span>`
    : "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
  <tr>
    <td align="left" style="vertical-align:middle;">
      ${emailLogoHtml()}
    </td>
    <td align="right" style="vertical-align:middle;">
      ${badgeHtml}
    </td>
  </tr>
</table>`.trim();
}
