import { describe, expect, it } from "vitest";
import { protectMediaEmbeds } from "../protectMediaEmbeds";

const ASSET_URL =
  "https://firebasestorage.googleapis.com/v0/b/f.appspot.com/o/imgs%2Fapp%2Fgraph%2F5AwymdkFOm.pdf?alt=media&token=70592b01-5df2-40ca-b898-c2c21079373c";

/**
 * Every keyword below was run through `block.fromMarkdown` in a graph. Wrapped, each came
 * back as it went in, except that parentheses come back percent-encoded; bare, each came
 * back mangled.
 *
 * Roam documents none of this, so the parser changing has to fail here rather than in a
 * user's page.
 */
describe("protectMediaEmbeds", () => {
  it.each(["pdf", "audio", "video", "iframe", "youtube"])(
    "wraps a %s embed's URL",
    (keyword) => {
      expect(protectMediaEmbeds(`{{[[${keyword}]]: ${ASSET_URL}}}`)).toBe(
        `{{[[${keyword}]]: <${ASSET_URL}>}}`,
      );
      expect(protectMediaEmbeds(`{{${keyword}: ${ASSET_URL}}}`)).toBe(
        `{{${keyword}: <${ASSET_URL}>}}`,
      );
    },
  );

  it("keeps the spacing an embed was written with", () => {
    expect(protectMediaEmbeds(`{{[[pdf]]:${ASSET_URL}}}`)).toBe(
      `{{[[pdf]]:<${ASSET_URL}>}}`,
    );
    expect(protectMediaEmbeds(`{{[[pdf]]:   ${ASSET_URL}  }}`)).toBe(
      `{{[[pdf]]:   <${ASSET_URL}>  }}`,
    );
  });

  it("leaves a URL's percent-escapes exactly as written", () => {
    const lowercased = ASSET_URL.replace("%2F", "%2f");
    expect(protectMediaEmbeds(`{{[[pdf]]: ${lowercased}}}`)).toBe(
      `{{[[pdf]]: <${lowercased}>}}`,
    );
  });

  it("wraps an embed a caller marked, without disturbing the marker", () => {
    expect(
      protectMediaEmbeds(`{{[[pdf]]: ${ASSET_URL}}} (Failed to import)`),
    ).toBe(`{{[[pdf]]: <${ASSET_URL}>}} (Failed to import)`);
  });

  it("wraps a URL holding parentheses, which a bare-URL pattern would stop at", () => {
    const parenthesised = "https://en.wikipedia.org/wiki/Foo_(bar).pdf";
    expect(protectMediaEmbeds(`{{[[pdf]]: ${parenthesised}}}`)).toBe(
      `{{[[pdf]]: <${parenthesised}>}}`,
    );
  });

  it("wraps an external embed, which no asset row covers", () => {
    expect(
      protectMediaEmbeds(`{{[[pdf]]: https://example.org/paper.pdf}}`),
    ).toBe(`{{[[pdf]]: <https://example.org/paper.pdf>}}`);
  });

  it("wraps every embed in a multi-line note", () => {
    expect(
      protectMediaEmbeds(
        `Protocol: {{[[pdf]]: ${ASSET_URL}}}\nRecording: {{[[audio]]: ${ASSET_URL}}}`,
      ),
    ).toBe(
      `Protocol: {{[[pdf]]: <${ASSET_URL}>}}\nRecording: {{[[audio]]: <${ASSET_URL}>}}`,
    );
  });

  it("is idempotent, so a wrapped embed is never wrapped twice", () => {
    const once = protectMediaEmbeds(`{{[[pdf]]: ${ASSET_URL}}}`);
    expect(protectMediaEmbeds(once)).toBe(once);
  });

  // Roam writes this one out as a markdown link whether or not the URL is wrapped, so
  // matching it would claim a protection that does not exist.
  it("leaves a URL holding square brackets alone", () => {
    const bracketed = "{{[[pdf]]: https://example.org/a[b].pdf}}";
    expect(protectMediaEmbeds(bracketed)).toBe(bracketed);
  });

  // These survive `fromMarkdown` as they are, so wrapping them would buy nothing.
  it.each([
    ["an image embed", `![](${ASSET_URL})`],
    ["a bare URL", ASSET_URL],
    ["a markdown link", `[the paper](${ASSET_URL})`],
    ["a component that carries no URL", `{{[[TODO]]}}`],
    ["an embed of a vault path", `{{[[pdf]]: attachments/paper.pdf}}`],
  ])("leaves %s alone", (_name, markdown) => {
    expect(protectMediaEmbeds(markdown)).toBe(markdown);
  });
});
