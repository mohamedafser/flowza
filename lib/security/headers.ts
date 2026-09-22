/**
 * Production security headers helpers (unit-tested).
 * `next.config.ts` inlines an equivalent CSP so the config does not import
 * application modules during Next bootstrap.
 */

export type SecurityHeader = { key: string; value: string };

function supabaseHostPattern(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    return "https://*.supabase.co wss://*.supabase.co";
  }
  try {
    const host = new URL(url).host;
    return `https://${host} wss://${host} https://*.supabase.co wss://*.supabase.co`;
  } catch {
    return "https://*.supabase.co wss://*.supabase.co";
  }
}

export function buildContentSecurityPolicy(
  options: { isProduction?: boolean } = {},
): string {
  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === "production";
  const supabase = supabaseHostPattern();
  // React/Next require unsafe-eval in development only.
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} https://api.razorpay.com https://lumberjack.razorpay.com`,
    "frame-src https://api.razorpay.com https://*.razorpay.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export function buildSecurityHeaders(): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
