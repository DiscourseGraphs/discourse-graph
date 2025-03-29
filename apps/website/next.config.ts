import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
  },
  serverRuntimeConfig: {
    maxDuration: 300,
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || "development",
  },
};
export default nextConfig;
