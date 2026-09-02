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
        modifiedTime: "2026-08-25",
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
  });
});

describe("getDocsPageDetails", () => {
  it("uses collective attribution without inventing an update date", () => {
    expect(getDocsPageDetails({ title: "Roam documentation" })).toEqual({
      author: DOCS_AUTHOR,
      updatedAt: undefined,
    });
  });
});
