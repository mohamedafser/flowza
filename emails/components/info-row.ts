import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from "@/emails/theme";
import { escapeHtml, safeValue } from "@/emails/utils/personalize";

export function emailInfoRowHtml(opts: {
  label: string;
  value: string | number | null | undefined;
}): string {
  const label = escapeHtml(opts.label);
  const value = escapeHtml(safeValue(opts.value));

  return `
<tr>
  <td style="padding:6px 0;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.smallSize};color:${EMAIL_COLORS.textMuted};width:38%;vertical-align:top;">${label}</td>
  <td class="email-text" style="padding:6px 0;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.bodySize};font-weight:600;color:${EMAIL_COLORS.text};vertical-align:top;">${value}</td>
</tr>`.trim();
}

export function emailInfoTableHtml(
  rows: Array<{ label: string; value: string | number | null | undefined }>,
): string {
  const body = rows.map((row) => emailInfoRowHtml(row)).join("");
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0;">
  ${body}
</table>`.trim();
}
