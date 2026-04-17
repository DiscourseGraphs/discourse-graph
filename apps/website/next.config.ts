import nextra from "nextra";
import type { NextConfig } from "next";
import { config } from "@repo/database/dbDotEnv";
import { DOCS_REDIRECTS } from "./docsRouteMap";

config();

const withNextra = nextra({
  contentDirBasePath: "/docs",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: {
    maxDuration: 300,
  },
  async redirects() {
    return DOCS_REDIRECTS;
  },
  turbopack: {
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.tsx",
    },
  },
};

export default withNextra(nextConfig);
