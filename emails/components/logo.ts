import { EMAIL_BRAND, EMAIL_COLORS, EMAIL_TYPOGRAPHY } from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";

export function emailLogoHtml(): string {
  const alt = escapeHtml(EMAIL_BRAND.name);
  const src = escapeHtml(EMAIL_BRAND.logoUrl);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="vertical-align:middle;">
      <img src="${src}" width="36" height="36" alt="${alt}" style="display:block;border-radius:8px;width:36px;height:36px;" />
    </td>
    <td style="padding-left:10px;vertical-align:middle;">
      <span class="email-text" style="font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:16px;font-weight:700;letter-spacing:-0.02em;color:${EMAIL_COLORS.primary};">${alt}</span>
    </td>
  </tr>
</table>`.trim();
}
