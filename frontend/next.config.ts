import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* The monorepo keeps .env at the workspace root, one level above frontend. */
if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  try {
    const line = readFileSync(resolve(process.cwd(), "../.env"), "utf8")
      .split(/\r?\n/)
      .find((value) => value.startsWith("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="));
    const key = line?.slice("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=".length).trim();
    if (key) process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = key;
  } catch {
    /* Local frontend-only setups can provide the variable normally. */
  }
}

const isDev = process.env.NODE_ENV !== "production";

/*
 * The browser only ever talks to this origin. /api/* is forwarded to the
 * backend by proxy.ts, so no API host, database or model endpoint is exposed
 * to client code, and connect-src can stay 'self'.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' https://maps.googleapis.com https://maps.gstatic.com 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
  "img-src 'self' https://*.googleapis.com https://*.gstatic.com data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The talk companion needs the microphone and the safe zone needs location - on this origin only.
          { key: "Permissions-Policy", value: "microphone=(self), geolocation=(self), camera=(), payment=(), usb=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
