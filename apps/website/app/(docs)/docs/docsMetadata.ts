import type { Metadata } from "next";

export const DOCS_AUTHOR = "Discourse Graphs";

export type DocsPlatform = "obsidian" | "roam";

type DocsSourceMetadata = Metadata & {
  author?: unknown;
  date?: unknown;
  updatedAt?: unknown;
};

type DocsPageDetails = {
  author: string;
  publishedAt?: string;
  updatedAt?: string;
};

const getNonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getTitle = (metadata: DocsSourceMetadata): string =>
  getNonEmptyString(metadata.title) ?? "Documentation";

const getPlatformLabel = (platform: DocsPlatform): string =>
  platform === "obsidian" ? "Obsidian" : "Roam Research";

export const getDocsPageDetails = (
  metadata: DocsSourceMetadata,
): DocsPageDetails => ({
  author: getNonEmptyString(metadata.author) ?? DOCS_AUTHOR,
  publishedAt: getNonEmptyString(metadata.date),
  updatedAt: getNonEmptyString(metadata.updatedAt),
});

export const buildDocsPageMetadata = ({
  metadata,
  platform,
}: {
  metadata: DocsSourceMetadata;
  platform: DocsPlatform;
}): Metadata => {
  const title = getTitle(metadata);
  const description =
    getNonEmptyString(metadata.description) ??
    `${title} documentation for the Discourse Graph ${getPlatformLabel(platform)} plugin.`;
  const { author, publishedAt, updatedAt } = getDocsPageDetails(metadata);

  return {
    ...metadata,
    title,
    description,
    authors: [{ name: author }],
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      title,
      description,
      authors: [author],
      publishedTime: publishedAt,
      modifiedTime: updatedAt,
    },
    twitter: {
      ...metadata.twitter,
      title,
      description,
    },
  };
};
