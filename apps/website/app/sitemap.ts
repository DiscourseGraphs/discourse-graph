import fs from "node:fs/promises";
import path from "node:path";
import type { MetadataRoute } from "next";
import { getAllBlogs } from "./(home)/blog/readBlogs";

const SITE_URL = "https://discoursegraphs.com";
const DOCS_DIRECTORY = path.join(process.cwd(), "content");
const DOCS_PLATFORMS = ["obsidian", "roam"] as const;
const DOCS_FILE_EXTENSION_RE = /\.mdx?$/u;

const getDocsContentPaths = async (directory: string): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const contentPaths = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return getDocsContentPaths(entryPath);
      }

      return DOCS_FILE_EXTENSION_RE.test(entry.name) ? [entryPath] : [];
    }),
  );

  return contentPaths.flat();
};

const getDocsRoute = (contentPath: string): string => {
  const relativePath = path.relative(DOCS_DIRECTORY, contentPath);
  const routePath = relativePath
    .replace(DOCS_FILE_EXTENSION_RE, "")
    .split(path.sep)
    .filter((segment) => segment !== "index")
    .join("/");

  return `/docs/${routePath}`;
};

const getDocsRoutes = async (): Promise<string[]> => {
  const contentPaths = await Promise.all(
    DOCS_PLATFORMS.map((platform) =>
      getDocsContentPaths(path.join(DOCS_DIRECTORY, platform)),
    ),
  );

  return contentPaths.flat().map(getDocsRoute);
};

const createSitemapEntry = (route: string): MetadataRoute.Sitemap[number] => ({
  url: new URL(route, SITE_URL).toString(),
});

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const [blogs, docsRoutes] = await Promise.all([
    getAllBlogs(),
    getDocsRoutes(),
  ]);
  const blogRoutes = blogs.map(({ slug }) => `/blog/${slug}`);
  const routes = ["/", "/blog", "/docs", ...blogRoutes, ...docsRoutes];

  return [...new Set(routes)].sort().map(createSitemapEntry);
};

export default sitemap;
