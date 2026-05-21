import nextra from "nextra";
import type { NextConfig } from "next";
import type { RouteHas } from "next/dist/lib/load-custom-routes";
import { config } from "@repo/database/dbDotEnv";
import { DOCS_REDIRECTS } from "./docsRouteMap";

config();

// expose supabase credentials to the client
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;

const withNextra = nextra({
  contentDirBasePath: "/docs",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["jsdom", "@automerge/automerge"],
  async redirects() {
    return DOCS_REDIRECTS;
  },
  async rewrites() {
    function negotiateSchema(prefix: string) {
      return {
        source: `${prefix}`,
        has: [
          {
            type: "header",
            key: "accept",
            value: "(.*)(\\btext/turtle\\b|\\btext/\\*|\\*/\\*)(.*)",
          } as RouteHas,
        ],
        destination: `${prefix}.ttl`,
      };
    }
    return {
      beforeFiles: [
        negotiateSchema("/schema/dg_base"),
        negotiateSchema("/schema/dg_core"),
      ],
    };
  },

  turbopack: {
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.tsx",
    },
  },
  images: {
    qualities: [75, 85, 100],
  },
  async headers() {
    return [
      {
        source: "/auth/token",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default withNextra(nextConfig);
