/** @type {import('next').NextConfig} */

const isLocalDev = process.env.NODE_ENV !== "production";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (isLocalDev ? "http://localhost:8000" : null);

const proxyUrl =
  process.env.INTERNAL_API_URL ||
  apiUrl ||
  (process.env.NODE_ENV === "production"
    ? "https://pandas-store-api.onrender.com"
    : null);

const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    if (!proxyUrl) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${proxyUrl}/api/:path*`,
      },
      {
        source: "/git/:path*",
        destination: `${proxyUrl}/git/:path*`,
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
