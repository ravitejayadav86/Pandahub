/** @type {import('next').NextConfig} */

// In production (Vercel, Render, etc.) NEXT_PUBLIC_API_URL MUST be set to a
// real public backend URL. Silently falling back to "http://localhost:8000"
// in that environment is exactly what caused the Vercel
// DNS_HOSTNAME_RESOLVED_PRIVATE error -- Vercel's edge network refuses to
// proxy to a private/loopback address, and localhost from Vercel's servers
// points at nothing. So: only apply the localhost fallback in local dev;
// in any other environment, skip the rewrite entirely and warn loudly at
// build time instead of failing confusingly on every request at runtime.
const isLocalDev = process.env.NODE_ENV !== "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || (isLocalDev ? "http://localhost:8000" : null);

if (!apiUrl) {
  console.warn(
    "\n⚠️  NEXT_PUBLIC_API_URL is not set in a production build.\n" +
    "   /api/* requests will NOT be proxied to a backend.\n" +
    "   Set NEXT_PUBLIC_API_URL in your deployment platform's environment variables\n" +
    "   (e.g. https://pandahub-backend.onrender.com) and redeploy.\n"
  );
}

const nextConfig = {
  reactStrictMode: true,

  // Proxy /api and /ws calls to the backend so the browser never needs to
  // know about container networking (talks to same-origin). Only added
  // when we actually have a valid target -- see warning above for why.
  async rewrites() {
    if (!apiUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**.pandahub.dev" },
      { protocol: "https", hostname: "**.onrender.com" },
    ],
  },
};

export default nextConfig;
