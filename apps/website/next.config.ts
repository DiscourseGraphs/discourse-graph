import type { NextConfig } from "next";
import { config } from "@repo/database/dbDotEnv";

config();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
};
export default nextConfig;
