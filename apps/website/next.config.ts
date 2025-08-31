import type { NextConfig } from "next";
import { envContents } from "@repo/database/dbDotEnv";

Object.entries(envContents()).map(([k, v]) => {
  if (v) process.env[k] = v;
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
};
export default nextConfig;
