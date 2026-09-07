import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  afterEach(() => vi.restoreAllMocks());

  it("excludes documentation explicitly marked unpublished", async () => {
    const readFile = fs.readFile.bind(fs);
    vi.spyOn(fs, "readFile").mockImplementation(async (file, options) => {
      if (
        typeof file === "string" &&
        file.endsWith(path.join("roam", "welcome", "getting-started.md"))
      ) {
        return "---\npublished: false\n---\nDraft documentation";
      }
      return readFile(file, options);
    });

    const entries = await sitemap();
    expect(entries.map(({ url }) => url)).not.toContain(
      "https://discoursegraphs.com/docs/roam/welcome/getting-started",
    );
  });

  it("lists the public marketing and documentation routes", async () => {
    const entries = await sitemap();
    const urls = entries.map(({ url }) => url);

    expect(urls).toContain("https://discoursegraphs.com/");
    expect(urls).toContain("https://discoursegraphs.com/blog");
    expect(urls).toContain("https://discoursegraphs.com/docs");
    expect(urls).toContain("https://discoursegraphs.com/docs/obsidian");
    expect(urls).toContain("https://discoursegraphs.com/docs/roam");
    expect(urls).toContain(
      "https://discoursegraphs.com/docs/roam/welcome/getting-started",
    );
  });

  it("uses unique absolute URLs and excludes non-public routes", async () => {
    const entries = await sitemap();
    const urls = entries.map(({ url }) => url);

    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://"))).toBe(true);
    expect(urls.some((url) => url.includes("/auth/"))).toBe(false);
    expect(urls.some((url) => url.includes("/api/"))).toBe(false);
    expect(urls).not.toContain("https://discoursegraphs.com/blog/EXAMPLE");
  });
});
