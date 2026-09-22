import {
  EMAIL_COLORS,
  EMAIL_RADIUS,
  EMAIL_TYPOGRAPHY,
} from "@/emails/theme";
import { escapeHtml, formatExpiryMinutes } from "@/emails/utils/personalize";

export function emailOtpHtml(opts: {
  code: string;
  expiryMinutes: number;
}): string {
  const code = escapeHtml(opts.code.replace(/\s+/g, ""));
  const expiry = formatExpiryMinutes(opts.expiryMinutes);

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-otp" style="margin:8px 0 4px;">
  <tr>
    <td align="center" style="background-color:${EMAIL_COLORS.otpBg};border:1px solid ${EMAIL_COLORS.otpBorder};border-radius:${EMAIL_RADIUS.otp};padding:22px 16px;">
      <p class="email-otp-code email-text" style="margin:0 0 10px;font-family:${EMAIL_TYPOGRAPHY.monoFamily};font-size:${EMAIL_TYPOGRAPHY.otpSize};font-weight:700;letter-spacing:${EMAIL_TYPOGRAPHY.otpLetterSpacing};color:${EMAIL_COLORS.primary};line-height:1.2;">${code}</p>
      <p class="email-muted" style="margin:0;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.smallSize};color:${EMAIL_COLORS.textMuted};">Expires in ${escapeHtml(expiry)} · one-time use</p>
    </td>
  </tr>
</table>`.trim();
}
