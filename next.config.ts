import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
if (!isDevelopment && process.env.HOLYHUB_LOCAL_DEMO === "true") {
  throw new Error("The in-memory demo must never be built or deployed as production.");
}
const codespaceHost = process.env.CODESPACE_NAME ? `${process.env.CODESPACE_NAME}-3000.app.github.dev` : undefined;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: isDevelopment && codespaceHost ? [codespaceHost] : [],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
      allowedOrigins: isDevelopment
        ? [
            "localhost:3000",
            "127.0.0.1:3000",
            ...(codespaceHost ? [codespaceHost] : []),
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
