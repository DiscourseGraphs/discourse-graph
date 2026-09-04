import { describe, expect, it } from "vitest";
import { serializeStructuredData } from "~/components/JsonLd";
import {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createDocsBreadcrumbStructuredData,
  createPersonStructuredData,
  createSiteStructuredData,
  createStructuredDataDocument,
  createVideoStructuredData,
  type StructuredDataNode,
} from "~/utils/structuredData";

describe("structured data", () => {
  it("builds linked Organization and WebSite nodes with absolute URLs", () => {
    const data = createSiteStructuredData({
      description: "Collaborative knowledge synthesis",
    });

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://discoursegraphs.com/#organization",
          logo: "https://discoursegraphs.com/DG-lockup.svg",
        },
        {
          "@type": "WebSite",
          "@id": "https://discoursegraphs.com/#website",
          publisher: {
            "@id": "https://discoursegraphs.com/#organization",
          },
        },
      ],
    });
  });

  it("uses blog frontmatter to build an Article and its breadcrumbs", () => {
    const article = createArticleStructuredData({
      author: "Joel Chan",
      datePublished: "2026-09-02",
      description: "A project update.",
      keywords: ["release"],
      path: "/blog/project-update",
      title: "Project update",
    });
    const breadcrumbs = createBreadcrumbStructuredData([
      { name: "Home", path: "/" },
      { name: "Updates", path: "/blog" },
      { name: "Project update", path: "/blog/project-update" },
    ]);

    expect(article).toMatchObject({
      "@type": "Article",
      author: { "@type": "Person", name: "Joel Chan" },
      datePublished: "2026-09-02",
      mainEntityOfPage: "https://discoursegraphs.com/blog/project-update",
      publisher: { "@id": "https://discoursegraphs.com/#organization" },
      url: "https://discoursegraphs.com/blog/project-update",
    });
    expect(breadcrumbs).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: "https://discoursegraphs.com/" },
        { position: 2, item: "https://discoursegraphs.com/blog" },
        {
          position: 3,
          item: "https://discoursegraphs.com/blog/project-update",
        },
      ],
    });
  });

  it("omits a non-routable category from nested docs breadcrumbs", () => {
    const breadcrumbs = createDocsBreadcrumbStructuredData({
      mdxPath: ["advanced-features", "command-palette"],
      platform: "obsidian",
      title: "Use the command palette",
    });

    expect(breadcrumbs).toMatchObject({
      itemListElement: [
        { name: "Home", item: "https://discoursegraphs.com/" },
        {
          name: "Documentation",
          item: "https://discoursegraphs.com/docs",
        },
        {
          name: "Obsidian",
          item: "https://discoursegraphs.com/docs/obsidian",
        },
        {
          name: "Use the command palette",
          item: "https://discoursegraphs.com/docs/obsidian/advanced-features/command-palette",
        },
      ],
    });

    if (breadcrumbs["@type"] !== "BreadcrumbList") {
      throw new Error("Expected BreadcrumbList structured data");
    }

    expect(breadcrumbs.itemListElement.map(({ item }) => item)).not.toContain(
      "https://discoursegraphs.com/docs/obsidian/advanced-features",
    );
  });

  it("builds Person and VideoObject nodes from visible homepage data", () => {
    const person = createPersonStructuredData({
      image: "/team/joel.png",
      name: "Joel Chan",
      title: "Research",
    });
    const video = createVideoStructuredData({
      embedUrl: "https://www.youtube-nocookie.com/embed/53kLyq7PceQ",
      speakers: "Joel Chan, Protocol Labs Research Seminar",
      thumbnailUrl: "https://i.ytimg.com/vi/53kLyq7PceQ/hqdefault.jpg",
      title: "Accelerating Scientific Discovery with Discourse Graphs",
    });

    expect(person).toMatchObject({
      "@type": "Person",
      image: "https://discoursegraphs.com/team/joel.png",
    });
    expect(video).toMatchObject({
      "@type": "VideoObject",
      description:
        "Accelerating Scientific Discovery with Discourse Graphs. Featuring: Joel Chan, Protocol Labs Research Seminar.",
      embedUrl: "https://www.youtube-nocookie.com/embed/53kLyq7PceQ",
      thumbnailUrl: "https://i.ytimg.com/vi/53kLyq7PceQ/hqdefault.jpg",
    });
  });

  it("rejects structured data nodes with relative URLs", () => {
    const invalidNode = {
      "@type": "VideoObject",
      name: "Video",
      description: "Description",
      embedUrl: "/video",
      thumbnailUrl: "/thumbnail.jpg",
    } as unknown as StructuredDataNode;

    expect(() => createStructuredDataDocument([invalidNode])).toThrow(
      "Invalid URL",
    );
  });

  it("escapes script-breaking characters during serialization", () => {
    const data = createSiteStructuredData({
      description:
        "Knowledge </script> synthesis\u2028without script injection",
    });
    const serialized = serializeStructuredData(data);

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("\u2028");
    expect(serialized).toContain("\\u003c/script>");
    expect(serialized).toContain("\\u2028");
  });
});
