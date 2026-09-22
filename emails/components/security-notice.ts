import { emailAlertHtml } from "@/emails/components/alert";

export function emailSecurityNoticeHtml(opts?: {
  title?: string;
  body?: string;
}): string {
  return emailAlertHtml({
    tone: "WARNING",
    title: opts?.title ?? "Security note",
    body:
      opts?.body ??
      "Never share verification codes or passwords with anyone. We will never ask for your password by email.",
  });
}
