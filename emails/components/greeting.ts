import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from "@/emails/theme";
import { escapeHtml, safeName } from "@/emails/utils/personalize";

export function emailGreetingHtml(
  name?: string | null,
  fallback = "there",
): string {
  const greeting = `Hi ${safeName(name, fallback)},`;
  return `<p class="email-text" style="margin:0 0 14px;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.bodySize};line-height:${EMAIL_TYPOGRAPHY.bodyLineHeight};color:${EMAIL_COLORS.text};">${escapeHtml(greeting)}</p>`;
}

export function emailGreetingText(
  name?: string | null,
  fallback = "there",
): string {
  return `Hi ${safeName(name, fallback)},`;
}

export function emailHeadingHtml(text: string): string {
  return `<h1 class="email-text" style="margin:0 0 12px;font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.headingSize};line-height:${EMAIL_TYPOGRAPHY.headingLineHeight};font-weight:700;letter-spacing:-0.02em;color:${EMAIL_COLORS.primary};">${escapeHtml(text)}</h1>`;
}

export function emailParagraphHtml(
  text: string,
  opts?: { muted?: boolean; marginBottom?: string },
): string {
  const color = opts?.muted ? EMAIL_COLORS.textMuted : EMAIL_COLORS.text;
  const mb = opts?.marginBottom ?? "14px";
  return `<p class="${opts?.muted ? "email-muted" : "email-text"}" style="margin:0 0 ${mb};font-family:${EMAIL_TYPOGRAPHY.fontFamily};font-size:${EMAIL_TYPOGRAPHY.bodySize};line-height:${EMAIL_TYPOGRAPHY.bodyLineHeight};color:${color};">${escapeHtml(text)}</p>`;
}
