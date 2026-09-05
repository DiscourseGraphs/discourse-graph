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

  it("matches a URL a sentence ended on, which the publisher recorded without its period", () => {
    // `findAssetReferences` strips trailing punctuation before writing `filepath`, so a
    // lookup that did not would leave the page pointing at the origin graph's storage.
    const asset = `https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2Fx.png?alt=media&token=abc`;

    expect(
      rewriteAssetLinks({
        markdown: `Protocol: ${asset}. Next sentence.`,
        assets: [{ sourceRef: asset, url: MIRRORED }],
      }),
    ).toBe(`Protocol: ![](${MIRRORED}). Next sentence.`);
  });

  it("keeps the sentence's punctuation outside the link it followed", () => {
    const asset =
      "https://firebasestorage.googleapis.com/v0/b/f/o/report?alt=media";

    expect(
      rewriteAssetLinks({
        markdown: `See ${asset}, then stop.`,
        assets: [
          { sourceRef: asset, url: MIRRORED, sourcePath: "report.docx" },
        ],
      }),
    ).toBe(`See [report.docx](${MIRRORED}), then stop.`);
  });

  it("rewrites an image nested in a link without swallowing the outer bracket", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[![diagram](vault/d.png)](https://source.example)`,
        assets: [{ sourceRef: "vault/d.png", url: MIRRORED }],
      }),
    ).toBe(`[![diagram](${MIRRORED})](https://source.example)`);
  });

  it("matches a percent-encoded token against the decoded path Obsidian recorded", () => {
    // The note holds the encoded form; `metadataCache` gives the publisher the decoded
    // one, so every vault path with a space in it arrives spelled two ways.
    expect(
      rewriteAssetLinks({
        markdown: `![](my%20folder/d.png)`,
        assets: [{ sourceRef: "my folder/d.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("embeds a type the extension list does not know, because the markdown embedded it", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[photo.avif]]`,
        assets: [{ sourceRef: "photo.avif", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("embeds a storage URL carrying no extension at all", () => {
    const asset =
      "https://firebasestorage.googleapis.com/v0/b/f/o/abc?alt=media&token=1";

    expect(
      rewriteAssetLinks({
        markdown: `![](${asset})`,
        assets: [{ sourceRef: asset, url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("keeps the visible text of a deliberate link to an image", () => {
    // Roam renders no alt text, so embedding this would delete the words "Figure 3".
    expect(
      rewriteAssetLinks({
        markdown: `[Figure 3](vault/d.png)`,
        assets: [{ sourceRef: "vault/d.png", url: MIRRORED }],
      }),
    ).toBe(`[Figure 3](${MIRRORED})`);
  });

  it("labels a file whose recorded name is empty from its token", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[](notes/report.docx)`,
        assets: [
          { sourceRef: "notes/report.docx", url: MIRRORED, sourcePath: "" },
        ],
      }),
    ).toBe(`[report.docx](${MIRRORED})`);
  });

  it("treats a token whose extension names a prototype member as an unknown type", () => {
    // Not the assertion it looks like: the point is that the literal string `undefined`
    // never reaches the page. An unknown extension is a file, like any other.
    expect(
      rewriteAssetLinks({
        markdown: `![](vault/odd.constructor)`,
        assets: [{ sourceRef: "vault/odd.constructor", url: MIRRORED }],
      }),
    ).toBe(`[odd.constructor](${MIRRORED})`);
  });

  it("keeps the type a Roam media embed declared, which its storage URL cannot show", () => {
    const asset =
      "https://firebasestorage.googleapis.com/v0/b/f/o/abc?alt=media&token=1";

    expect(
      rewriteAssetLinks({
        markdown: `{{[[pdf]]: ${asset}}}`,
        assets: [{ sourceRef: asset, url: MIRRORED }],
      }),
    ).toBe(`{{[[pdf]]: ${MIRRORED}}}`);
    expect(
      rewriteAssetLinks({
        markdown: `{{audio: ${asset}}}`,
        assets: [{ sourceRef: asset, url: MIRRORED }],
      }),
    ).toBe(`{{[[audio]]: ${MIRRORED}}}`);
  });

  it("keeps a non-media wikilink embed a labelled link, so its name survives", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[notes/report.docx]]`,
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
