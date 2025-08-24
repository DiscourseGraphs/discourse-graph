import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
  transpilePackages: ["@repo/database", "@repo/utils", "@repo/ui"],
};
export default nextConfig;
