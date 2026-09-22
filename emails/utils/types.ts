import { EMAIL_BRAND } from "@/emails/theme";

export type EmailRenderResult = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplateDefinition = {
  subject: string;
  preheader?: string;
  /** HTML body inside the shared layout card (not including layout chrome). */
  htmlBody: string;
  /** Plain-text body (layout footer appended by renderer). */
  textBody: string;
  badge?: string;
  previewText?: string;
};

export function joinText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p == null ? "" : p))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textFooter(): string {
  const year = new Date().getFullYear();
  return [
    "—",
    `${EMAIL_BRAND.name}`,
    `Support: ${EMAIL_BRAND.supportEmail}`,
    `© ${year} ${EMAIL_BRAND.name}`,
  ].join("\n");
}
