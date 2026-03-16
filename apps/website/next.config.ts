import nextra from "nextra";
import type { NextConfig } from "next";
import { config } from "@repo/database/dbDotEnv";

config();

const withNextra = nextra({});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
  turbopack: {
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.tsx",
    },
  },
};

export default withNextra(nextConfig);
