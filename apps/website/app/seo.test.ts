import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SITE_URL,
  PUBLIC_STATIC_PATHS,
  getBlogPostPath,
  getCanonicalMetadata,
  getCanonicalUrl,
  getDocsPath,
} from "./seo";

describe("canonical metadata", () => {
  it("uses the production website origin", () => {
    expect(PRODUCTION_SITE_URL.href).toBe("https://discoursegraphs.com/");
  });

  it("keeps the public static route inventory canonical and absolute", () => {
    expect(
      Object.fromEntries(
        Object.entries(PUBLIC_STATIC_PATHS).map(([route, pathname]) => [
          route,
          getCanonicalUrl(pathname).href,
        ]),
      ),
    ).toEqual({
      blog: "https://discoursegraphs.com/blog",
      docs: "https://discoursegraphs.com/docs",
      extractNodes: "https://discoursegraphs.com/extract-nodes",
      home: "https://discoursegraphs.com/",
      nextra: "https://discoursegraphs.com/nextra",
      nextraGettingStarted:
        "https://discoursegraphs.com/nextra/getting-started",
      nextraTemplates: "https://discoursegraphs.com/nextra/templates",
    });
  });

  it("creates canonical metadata with an absolute URL", () => {
    expect(getCanonicalMetadata(PUBLIC_STATIC_PATHS.docs)).toEqual({
      alternates: {
        canonical: new URL("https://discoursegraphs.com/docs"),
      },
    });
  });

  it("builds canonical blog and docs paths without duplicate variants", () => {
    expect(getBlogPostPath("release notes")).toBe("/blog/release%20notes");
    expect(getDocsPath({ platform: "roam" })).toBe("/docs/roam");
    expect(
      getDocsPath({
        platform: "obsidian",
        mdxPath: ["welcome", "getting started"],
      }),
    ).toBe("/docs/obsidian/welcome/getting%20started");
  });
});
