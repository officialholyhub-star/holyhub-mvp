import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: isDevelopment ? ["*.app.github.dev"] : [],
  experimental: {
    serverActions: {
      allowedOrigins: isDevelopment
        ? [
            "fluffy-adventure-4qw46757wv6whqpg7-3000.app.github.dev",
            "*.app.github.dev",
          ]
        : [],
    },
  },
};

export default nextConfig;
