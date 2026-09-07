import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows public crawlers and references the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://discoursegraphs.com/sitemap.xml",
    });
  });
});
