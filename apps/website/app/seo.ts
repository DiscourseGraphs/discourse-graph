import type { Metadata } from "next";

export const PRODUCTION_SITE_URL = new URL("https://discoursegraphs.com");

export const PUBLIC_STATIC_PATHS = {
  blog: "/blog",
  docs: "/docs",
  extractNodes: "/extract-nodes",
  home: "/",
  nextra: "/nextra",
  nextraGettingStarted: "/nextra/getting-started",
  nextraTemplates: "/nextra/templates",
} as const;

export const getCanonicalUrl = (pathname: string): URL =>
  new URL(pathname, PRODUCTION_SITE_URL);

export const getCanonicalMetadata = (
  pathname: string,
): Pick<Metadata, "alternates"> => ({
  alternates: {
    canonical: getCanonicalUrl(pathname),
  },
});

export const getBlogPostPath = (slug: string): string =>
  `/blog/${encodeURIComponent(slug)}`;

export const getDocsPath = ({
  mdxPath,
  platform,
}: {
  mdxPath?: string[];
  platform: "obsidian" | "roam";
}): string => {
  const encodedPath = (mdxPath ?? []).map(encodeURIComponent).join("/");

  return `/docs/${platform}${encodedPath ? `/${encodedPath}` : ""}`;
};
