import { describe, expect, it } from "vitest";
import {
  obsidianOriginNodeExample,
  roamOriginNodeExample,
} from "@repo/database/crossAppNodeContract.example";
import { rewriteAssetLinks } from "../rewriteAssetLinks";

const MIRRORED =
  "https://firebasestorage.googleapis.com/v0/b/f.appspot.com/o/x?alt=media&token=abc";
const OTHER_MIRRORED =
  "https://firebasestorage.googleapis.com/v0/b/f.appspot.com/o/y?alt=media&token=def";
const EXTERNAL = "https://example.org/paper.pdf";

describe("rewriteAssetLinks", () => {
  it("rewrites an image embed to this graph's copy", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![](vault/diagram.png)`,
        assets: [{ sourceRef: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("keeps the alt text an image already carried", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![the setup](vault/diagram.png)`,
        assets: [{ sourceRef: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(`![the setup](${MIRRORED})`);
  });

  it("writes a non-media asset as a labelled link, not a bare URL", () => {
    // A bare URL renders as a link whose visible text is the URL, which tells the reader
    // nothing about what the file is.
    expect(
      rewriteAssetLinks({
        markdown: `[](attachments/report.docx)`,
        assets: [
          {
            sourceRef: "attachments/report.docx",
            url: MIRRORED,
            sourcePath: "attachments/report.docx",
          },
        ],
      }),
    ).toBe(`[report.docx](${MIRRORED})`);
  });

  it("leaves an external link untouched, because no row matches it", () => {
    const markdown = `See [the paper](${EXTERNAL}) and ![](${EXTERNAL})`;
    expect(
      rewriteAssetLinks({
        markdown,
        assets: [{ sourceRef: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(markdown);
  });

  it("uses Roam's own embed syntax for media types", () => {
    const assets = [
      { sourceRef: "a.pdf", url: MIRRORED, mimetype: "application/pdf" },
      { sourceRef: "b.mp3", url: OTHER_MIRRORED },
    ];
    expect(
      rewriteAssetLinks({ markdown: `![](a.pdf) and ![](b.mp3)`, assets }),
    ).toBe(`{{[[pdf]]: ${MIRRORED}}} and {{[[audio]]: ${OTHER_MIRRORED}}}`);
  });

  it("resolves a Roam-origin media embed through its row rather than passing it through", () => {
    const published = `${MIRRORED.replace("/o/x", "/o/original")}`;
    expect(
      rewriteAssetLinks({
        markdown: `Protocol: {{[[pdf]]: ${published}}}`,
        assets: [
          { sourceRef: published, url: MIRRORED, sourcePath: "protocol.pdf" },
        ],
      }),
    ).toBe(`Protocol: {{[[pdf]]: ${MIRRORED}}}`);
  });

  it("rewrites an Obsidian wikilink embed", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[attachments/scan.png]]`,
        assets: [{ sourceRef: "attachments/scan.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("leaves a page reference alone, since a page name is not a recorded token", () => {
    const markdown = `Supported by [[EVD]] - Rasch & Born 2013`;
    expect(
      rewriteAssetLinks({
        markdown,
        assets: [{ sourceRef: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(markdown);
  });

  it("rewrites every occurrence of a token the content repeats", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![](a.png)\n\nand again ![](a.png)`,
        assets: [{ sourceRef: "a.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})\n\nand again ![](${MIRRORED})`);
  });

  // A Roam-origin non-media asset arrives as a bare storage URL, and Roam renders a bare
  // URL using the URL itself as the link text. The recorded name is the only place a
  // reader ever learns what the file is called.
  it("labels a non-media link with the recorded name rather than the storage URL", () => {
    const published = `${MIRRORED.replace("/o/x", "/o/GVfB6XBcMR")}`;
    const result = rewriteAssetLinks({
      markdown: `Protocol: ${published}`,
      assets: [
        { sourceRef: published, url: MIRRORED, sourcePath: "report.docx" },
      ],
    });

    expect(result).toBe(`Protocol: [report.docx](${MIRRORED})`);
    expect(result).not.toContain(published);
  });

  it("prefers display text the source already wrote over the recorded name", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[the protocol](notes/report.docx)`,
        assets: [
          {
            sourceRef: "notes/report.docx",
            url: MIRRORED,
            sourcePath: "report.docx",
          },
        ],
      }),
    ).toBe(`[the protocol](${MIRRORED})`);
  });

  it("falls back to the token's own name when nothing was recorded", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[](notes/report.docx)`,
        assets: [{ sourceRef: "notes/report.docx", url: MIRRORED }],
      }),
    ).toBe(`[report.docx](${MIRRORED})`);
  });

  it("returns the markdown untouched when the node has no assets", () => {
    const markdown = `![](a.png) and [[EVD]]`;
    expect(rewriteAssetLinks({ markdown, assets: [] })).toBe(markdown);
  });
});

describe("the cross-app contract fixtures round-trip", () => {
  const mirrorAll = (node: typeof roamOriginNodeExample) =>
    (node.assets ?? []).map((asset) => ({
      sourceRef: asset.sourceRef,
      url: `${MIRRORED}#${asset.contentHash.slice(0, 8)}`,
      sourcePath: asset.sourcePath,
    }));

  it("resolves the Roam fixture's stored asset and leaves its unresolvable one in place", () => {
    const markdown = roamOriginNodeExample.content.full?.value ?? "";
    const [stored] = roamOriginNodeExample.assets ?? [];
    const result = rewriteAssetLinks({
      markdown,
      assets: mirrorAll(roamOriginNodeExample),
    });

    expect(result).not.toContain(stored?.sourceRef);
    expect(result).toContain(
      `![](${MIRRORED}#${stored?.contentHash.slice(0, 8)})`,
    );
    // The fixture's second asset is deliberately absent from `assets`: its bytes were
    // never stored, so the token stays exactly as published. That is the degradation path.
    expect(result).toContain(
      "{{[[pdf]]: https://firebasestorage.googleapis.com",
    );
    expect(result).toContain("[[EVD]]");
  });

  it("resolves the Obsidian fixture's wikilink embed", () => {
    const markdown = obsidianOriginNodeExample.content.full?.value ?? "";
    const [asset] = obsidianOriginNodeExample.assets ?? [];
    const result = rewriteAssetLinks({
      markdown,
      assets: mirrorAll(obsidianOriginNodeExample),
    });

    expect(result).not.toContain(`![[${asset?.sourceRef}]]`);
    expect(result).toContain(
      `![](${MIRRORED}#${asset?.contentHash.slice(0, 8)})`,
    );
  });
});
