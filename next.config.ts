import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "node:path";

function securityHeaders() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let supabaseConnect =
    "https://*.supabase.co wss://*.supabase.co";
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).host;
      supabaseConnect = `https://${host} wss://${host} https://*.supabase.co wss://*.supabase.co`;
    } catch {
      // keep wildcard fallback
    }
  }

  // React/Next need unsafe-eval in development for stack reconstruction.
  // Production CSP stays without unsafe-eval.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com";

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnect} https://api.razorpay.com https://lumberjack.razorpay.com`,
    "frame-src https://api.razorpay.com https://*.razorpay.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(process.env.NODE_ENV === "production"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");

  const headers = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    importScripts: ["/sw-push.js"],
    runtimeCaching: [
      {
        urlPattern: ({ request, url }: { request: Request; url: URL }) =>
          request.method === "GET" &&
          (url.pathname.startsWith("/api/") ||
            url.pathname.startsWith("/auth/") ||
            url.pathname.startsWith("/dashboard") ||
            url.pathname.startsWith("/settings") ||
            url.pathname.startsWith("/admin") ||
            url.pathname.startsWith("/onboarding") ||
            url.pathname.startsWith("/suspended") ||
            url.pathname.startsWith("/api/notifications") ||
            url.pathname.startsWith("/api/billing") ||
            url.pathname.startsWith("/api/admin") ||
            url.pathname === "/login" ||
            url.pathname === "/signup" ||
            url.pathname === "/forgot-password" ||
            url.pathname === "/reset-password" ||
            url.pathname === "/verify-email" ||
            url.pathname.includes("/queue") ||
            url.pathname.includes("/tables") ||
            url.pathname.includes("/customers") ||
            url.pathname.includes("/reservations") ||
            url.pathname.includes("/realtime")),
        handler: "NetworkOnly",
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
      },
      {
        urlPattern: ({ request }: { request: Request }) =>
          request.destination === "image",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "flowza-images",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          },
        },
      },
      {
        urlPattern: ({ request }: { request: Request }) =>
          request.destination === "style" ||
          request.destination === "script" ||
          request.destination === "font",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "flowza-static-assets",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
      {
        urlPattern: ({ request }: { request: Request }) =>
          request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "flowza-pages",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24,
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Isolate tracing from the parent Documents folder package-lock.json
  outputFileTracingRoot: path.join(__dirname),
  // next-pwa injects webpack config; empty turbopack config opts into Turbopack for `next dev`
  turbopack: {},
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
};

export default withPWA(nextConfig);
