import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || "development",
  },
};
export default nextConfig;
