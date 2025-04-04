import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
};
export default nextConfig;
