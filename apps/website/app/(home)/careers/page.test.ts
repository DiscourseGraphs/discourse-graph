import type { ResolvingMetadata } from "next";
import { describe, expect, it } from "vitest";
import { generateMetadata } from "./page";

describe("careers metadata", () => {
  it("supports Nextra page-map calls without parent metadata", async () => {
    const metadata = await generateMetadata({});

    expect(metadata.openGraph).toMatchObject({
      title: "Database engineer | Discourse Graphs",
      description: metadata.description,
    });
    expect(metadata.twitter).toMatchObject({
      title: metadata.title,
      description: metadata.description,
    });
  });

  it("preserves inherited social metadata when called by Next.js", async () => {
    const parent = Promise.resolve({
      openGraph: { images: [{ url: "https://example.com/social.png" }] },
      twitter: { card: "summary_large_image" },
    }) as ResolvingMetadata;

    const metadata = await generateMetadata({}, parent);

    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "https://example.com/social.png" }],
      title: metadata.title,
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
