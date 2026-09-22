import {
  EMAIL_BUTTONS,
  EMAIL_COLORS,
  EMAIL_RADIUS,
  EMAIL_TYPOGRAPHY,
} from "@/emails/theme";
import { escapeHtml } from "@/emails/utils/personalize";

export type EmailButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost";

const VARIANT_STYLES: Record<
  EmailButtonVariant,
  { bg: string; color: string; border: string }
> = {
  primary: {
    bg: EMAIL_BUTTONS.primaryBg,
    color: EMAIL_BUTTONS.primaryText,
    border: EMAIL_BUTTONS.primaryBg,
  },
  secondary: {
    bg: EMAIL_BUTTONS.secondaryBg,
    color: EMAIL_BUTTONS.secondaryText,
    border: EMAIL_COLORS.border,
  },
  success: {
    bg: EMAIL_BUTTONS.successBg,
    color: EMAIL_BUTTONS.successText,
    border: EMAIL_BUTTONS.successBg,
  },
  danger: {
    bg: EMAIL_BUTTONS.dangerBg,
    color: EMAIL_BUTTONS.dangerText,
    border: EMAIL_BUTTONS.dangerBg,
  },
  ghost: {
    bg: EMAIL_BUTTONS.ghostBg,
    color: EMAIL_BUTTONS.ghostText,
    border: EMAIL_COLORS.border,
  },
};

/**
 * Outlook-safe table button with large mobile tap target.
 */
export function emailButtonHtml(opts: {
  href: string;
  label: string;
  variant?: EmailButtonVariant;
}): string {
  const variant = opts.variant ?? "primary";
  const styles = VARIANT_STYLES[variant];
  const href = escapeHtml(opts.href);
  const label = escapeHtml(opts.label);

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="email-btn" style="margin:20px 0 4px;">
  <tr>
    <td align="center" bgcolor="${styles.bg}" style="border-radius:${EMAIL_RADIUS.button};background-color:${styles.bg};border:1px solid ${styles.border};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="18%" stroke="f" fillcolor="${styles.bg}">
        <w:anchorlock/>
        <center style="color:${styles.color};font-family:sans-serif;font-size:14px;font-weight:600;">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${href}" style="display:inline-block;padding:${EMAIL_BUTTONS.padding};font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_BUTTONS.fontSize};font-weight:${EMAIL_BUTTONS.fontWeight};line-height:1.2;color:${styles.color};text-decoration:none;border-radius:${EMAIL_RADIUS.button};min-width:160px;text-align:center;">${label}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}
