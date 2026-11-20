import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundationsSection } from "~/components/FoundationsSection";
import { MIRA_URL } from "~/data/constants";

describe("FoundationsSection", () => {
  it("links only the Protocol card to Mira in a new tab", () => {
    const html = renderToStaticMarkup(<FoundationsSection />);
    const links = [...html.matchAll(/<a [^>]*>(?:(?!<\/a>).)*Learn more/gs)];

    expect(links).toHaveLength(1);
    expect(links[0]?.[0]).toContain(`href="${MIRA_URL}"`);
    expect(links[0]?.[0]).toContain('target="_blank"');
    expect(MIRA_URL).toBe("https://mira.science/");
  });
});
