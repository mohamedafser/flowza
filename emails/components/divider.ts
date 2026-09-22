import { EMAIL_COLORS } from "@/emails/theme";

export function emailDividerHtml(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
  <tr>
    <td style="border-top:1px solid ${EMAIL_COLORS.border};font-size:0;line-height:0;">&nbsp;</td>
  </tr>
</table>`.trim();
}
