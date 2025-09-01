import type { NextConfig } from "next";
const { config } = require("@repo/database/dbDotEnv");

config();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
};
export default nextConfig;
