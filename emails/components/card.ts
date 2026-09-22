import {
  EMAIL_COLORS,
  EMAIL_RADIUS,
  EMAIL_TYPOGRAPHY,
} from "@/emails/theme";

export function emailCardHtml(opts: {
  children: string;
  accent?: "default" | "otp" | "success" | "warning" | "info";
}): string {
  const borders: Record<string, string> = {
    default: EMAIL_COLORS.border,
    otp: EMAIL_COLORS.otpBorder,
    success: EMAIL_COLORS.successBorder,
    warning: EMAIL_COLORS.warningBorder,
    info: EMAIL_COLORS.infoBorder,
  };
  const bgs: Record<string, string> = {
    default: EMAIL_COLORS.borderSoft,
    otp: EMAIL_COLORS.otpBg,
    success: EMAIL_COLORS.successBg,
    warning: EMAIL_COLORS.warningBg,
    info: EMAIL_COLORS.infoBg,
  };
  const accent = opts.accent ?? "default";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:12px 0;">
  <tr>
    <td style="background-color:${bgs[accent]};border:1px solid ${borders[accent]};border-radius:${EMAIL_RADIUS.inner};padding:16px 18px;font-family:${EMAIL_TYPOGRAPHY.fontFamily};">
      ${opts.children}
    </td>
  </tr>
</table>`.trim();
}
