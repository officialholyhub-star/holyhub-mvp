import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins:
        process.env.NODE_ENV === "development"
          ? ["fluffy-adventure-4qw46757wv6whqpg7-3000.app.github.dev"]
          : [],
    },
  },
};

export default nextConfig;
