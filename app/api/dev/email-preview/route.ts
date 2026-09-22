import { NextResponse } from "next/server";
import {
  EMAIL_PREVIEW_IDS,
  renderEmailPreview,
  type EmailPreviewId,
} from "@/emails/preview/samples";
import { escapeHtml } from "@/emails/utils/personalize";

export const dynamic = "force-dynamic";

function isPreviewId(value: string): value is EmailPreviewId {
  return (EMAIL_PREVIEW_IDS as readonly string[]).includes(value);
}

/**
 * Development-only email template preview.
 * Disabled in production to avoid exposing template HTML publicly.
 *
 * GET /api/dev/email-preview
 * GET /api/dev/email-preview?id=queue-called
 * GET /api/dev/email-preview?id=signup-otp&format=text
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const format = searchParams.get("format") === "text" ? "text" : "html";

  if (!idParam) {
    const links = EMAIL_PREVIEW_IDS.map((id) => {
      const href = `/api/dev/email-preview?id=${encodeURIComponent(id)}`;
      const textHref = `${href}&format=text`;
      return `<li style="margin:8px 0;"><a href="${href}">${escapeHtml(id)}</a> · <a href="${textHref}">text</a></li>`;
    }).join("");

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Email previews</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;">
  <h1>Email template previews</h1>
  <p>Development only. Not available in production.</p>
  <ul>${links}</ul>
</body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (!isPreviewId(idParam)) {
    return NextResponse.json(
      { error: "Unknown template id", ids: EMAIL_PREVIEW_IDS },
      { status: 400 },
    );
  }

  const rendered = renderEmailPreview(idParam);

  if (format === "text") {
    return new NextResponse(
      `${rendered.subject}\n\n${rendered.text}`,
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  return new NextResponse(rendered.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Email-Subject": rendered.subject,
    },
  });
}
