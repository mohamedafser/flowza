import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "node:path";

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
            url.pathname.startsWith("/onboarding") ||
            url.pathname.startsWith("/api/notifications") ||
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
};

export default withPWA(nextConfig);
