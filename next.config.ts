import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Supabase origins. The project URL comes from the environment so the policy
 * follows the project; `*.supabase.co` covers REST, Auth and Realtime (wss).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = (() => {
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy without nonces.
 *
 * A nonce-based policy forces every page to render dynamically, which would
 * turn the static landing, /login and /register into per-request renders. We
 * keep them static and accept 'unsafe-inline' for scripts and styles (Next.js
 * injects inline bootstrap scripts and Tailwind/Recharts inject inline styles).
 * Everything else is locked down. See docs/ISO_25010_AND_SECURITY.md.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Two years, subdomains and preload eligibility (HTTPS only; browsers ignore it on http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Anti-clickjacking. frame-ancestors above covers modern browsers; this covers legacy ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Do not advertise the framework in the X-Powered-By header.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
