import { EMAIL_BRAND, EMAIL_COLORS, EMAIL_FOOTER, EMAIL_TYPOGRAPHY } from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";

export function emailFooterHtml(): string {
  const year = new Date().getFullYear();
  const brand = escapeHtml(EMAIL_BRAND.name);
  const support = escapeHtml(EMAIL_BRAND.supportEmail);
  const privacy = escapeHtml(`${EMAIL_BRAND.appUrl}${EMAIL_BRAND.privacyPath}`);
  const terms = escapeHtml(`${EMAIL_BRAND.appUrl}${EMAIL_BRAND.termsPath}`);
  const mailto = escapeHtml(`mailto:${EMAIL_BRAND.supportEmail}`);

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td align="center" class="email-muted" style="font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.tinySize};line-height:1.6;color:${EMAIL_COLORS.textSubtle};padding:0 8px;">
      <p style="margin:0 0 6px;">${escapeHtml(EMAIL_FOOTER.copyright(year))}</p>
      <p style="margin:0 0 6px;">
        <a href="${privacy}" style="color:${EMAIL_COLORS.textMuted};text-decoration:underline;">Privacy</a>
        &nbsp;·&nbsp;
        <a href="${terms}" style="color:${EMAIL_COLORS.textMuted};text-decoration:underline;">Terms</a>
        &nbsp;·&nbsp;
        <a href="${mailto}" style="color:${EMAIL_COLORS.textMuted};text-decoration:underline;">Support</a>
      </p>
      <p style="margin:0;">${brand} · ${support}</p>
    </td>
  </tr>
</table>`.trim();
}
