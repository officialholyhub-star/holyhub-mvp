import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: isDevelopment ? ["*.app.github.dev"] : [],
  experimental: {
    serverActions: {
      allowedOrigins: isDevelopment
        ? [
            "localhost:3000",
            "127.0.0.1:3000",
            "fluffy-adventure-4qw46757wv6whqpg7-3000.app.github.dev",
            "*.app.github.dev",
          ]
        : [],
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
