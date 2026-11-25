import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { NodeBody } from "../../app/id/[id]/NodeBody";

const render = (contentType: string, text: string): string =>
  renderToStaticMarkup(
    <NodeBody contents={[{ content_type: contentType, text }]} />,
  );

it("renders stored Markdown and GitHub table and task syntax", () => {
  const html = render(
    "text/roam+markdown",
    "# Claim\n\n| A | B |\n|---|---|\n| **yes** | ~~no~~ |\n\n- [x] done",
  );
  for (const markup of [
    "<h1>Claim</h1>",
    "<table>",
    "<strong>yes</strong>",
    "<del>no</del>",
    'type="checkbox"',
  ])
    expect(html).toContain(markup);
});

it("omits leading Obsidian properties and escapes raw HTML", () => {
  const html = render(
    "text/obsidian+markdown",
    "---\r\nproperty: hidden\r\n---\r\n**hello** <b>literal</b>",
  );
  expect(html).toContain("<strong>hello</strong>");
  expect(html).toContain("&lt;b&gt;");
  expect(html).not.toContain("property");
});

it("preserves plain text and leaves unknown content types unrendered", () => {
  expect(render("text/plain", "**literal**")).toContain("**literal**");
  expect(render("application/json", "{}")).toBe("");
});

it("preserves the body and thematic break after empty Obsidian properties", () => {
  const html = render("text/obsidian+markdown", "---\n---\nBody\n\n---\nNext");
  expect(html).toContain("<p>Body</p>");
  expect(html).toContain("<hr");
  expect(html).toContain("<p>Next</p>");
});

it("accepts padded Obsidian fences and preserves the next thematic break", () => {
  const html = render(
    "text/obsidian+markdown",
    "--- \r\nproperty: hidden\r\n---\t\r\nKeep me\r\n\r\n---\r\nNext",
  );
  expect(html).not.toContain("property");
  expect(html).toContain("<p>Keep me</p>");
  expect(html).toContain("<hr");
});

it.each(["text/roam+markdown", "text/obsidian+markdown"])(
  "renders inline and reference images as escaped alt text for %s",
  (type) => {
    const html = render(
      type,
      '![**Local** &amp; file](figures/local.png "Local figure") and ![Remote][figure]\n\n[figure]: https://example.org/remote.png',
    );
    expect(html).toContain("<p>Local &amp; file and Remote</p>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain(".png");
  },
);
