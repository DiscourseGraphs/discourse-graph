import { describe, expect, it } from "vitest";
import {
  buildDocsPageMetadata,
  DOCS_AUTHOR,
  getDocsPageDetails,
} from "./docsMetadata";

describe("buildDocsPageMetadata", () => {
  it("preserves authored descriptions and exposes attribution and dates", () => {
    const metadata = buildDocsPageMetadata({
      metadata: {
        title: "Using the canvas",
        description: "Build and organize a Discourse Graph on the canvas.",
        author: "Documentation team",
        date: "2026-08-25",
        updatedAt: "2026-08-27",
      },
      platform: "roam",
    });

    expect(metadata).toMatchObject({
      title: "Using the canvas",
      description: "Build and organize a Discourse Graph on the canvas.",
      authors: [{ name: "Documentation team" }],
      openGraph: {
        type: "article",
        authors: ["Documentation team"],
        publishedTime: "2026-08-25",
        modifiedTime: "2026-08-27",
      },
    });
  });

  it("creates an accurate platform-specific description for sparse pages", () => {
    const metadata = buildDocsPageMetadata({
      metadata: {
        title: "Node search",
        author: "",
        date: "2026-08-23",
      },
      platform: "obsidian",
    });

    expect(metadata.description).toBe(
      "Node search documentation for the Discourse Graph Obsidian plugin.",
    );
    expect(metadata.authors).toEqual([{ name: DOCS_AUTHOR }]);
    expect(metadata.openGraph).toMatchObject({
      publishedTime: "2026-08-23",
      modifiedTime: undefined,
    });
  });
});

describe("getDocsPageDetails", () => {
  it("uses collective attribution without inventing an update date", () => {
    expect(getDocsPageDetails({ title: "Roam documentation" })).toEqual({
      author: DOCS_AUTHOR,
      publishedAt: undefined,
      updatedAt: undefined,
    });
  });

  it("does not treat a generic page date as a modification date", () => {
    expect(
      getDocsPageDetails({
        title: "Installation",
        date: "2025-01-01",
      }),
    ).toEqual({
      author: DOCS_AUTHOR,
      publishedAt: "2025-01-01",
      updatedAt: undefined,
    });
  });
});
