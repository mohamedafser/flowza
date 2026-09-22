import { EMAIL_BRAND } from "@/emails/theme";

/** Escape text for safe HTML email embedding. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Prefer a human name; never render "undefined" / "null". */
export function safeName(
  value: string | null | undefined,
  fallback = "there",
): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return fallback;
  }
  return trimmed;
}

export function safeValue(
  value: string | number | null | undefined,
  fallback = "—",
): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  if (!text || text === "undefined" || text === "null") return fallback;
  return text;
}

export function formatExpiryMinutes(minutes: number): string {
  const n = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 5;
  return `${n} minute${n === 1 ? "" : "s"}`;
}

export function formatDisplayDate(
  isoOrLabel: string | null | undefined,
): string {
  const raw = safeValue(isoOrLabel, "");
  if (!raw) return "—";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${EMAIL_BRAND.appUrl}${path}`;
}
