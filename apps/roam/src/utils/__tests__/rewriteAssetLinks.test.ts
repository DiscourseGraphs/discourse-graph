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
        assets: [{ sourceLocator: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  /**
   * CommonMark wraps a destination containing spaces in angle brackets, and Obsidian can
   * emit that form for a vault path. The brackets delimit the locator rather than belong
   * to it, so what matches a recorded row is the text between them.
   */
  it("resolves an image whose destination is wrapped in angle brackets", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![](<my folder/diagram.png>)`,
        assets: [{ sourceLocator: "my folder/diagram.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("resolves a bracketed link and keeps its label", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[the report](<my folder/report.docx>)`,
        assets: [{ sourceLocator: "my folder/report.docx", url: MIRRORED }],
      }),
    ).toBe(`[the report](${MIRRORED})`);
  });

  /**
   * An autolink is a bare URL the source wrapped in angle brackets. The brackets are part
   * of the match, not of the locator, so the rewrite takes them with it. Capturing only
   * the URL inside would leave `<` and `>` around the result, which Roam renders as text.
   */
  it("rewrites an autolink without leaving its brackets behind", () => {
    expect(
      rewriteAssetLinks({
        markdown: `<${EXTERNAL}>`,
        assets: [{ sourceLocator: EXTERNAL, url: MIRRORED }],
      }),
    ).toBe(`{{[[pdf]]: ${MIRRORED}}}`);
  });

  it("leaves an autolink alone when no row matches it", () => {
    const markdown = `<${EXTERNAL}>`;
    expect(rewriteAssetLinks({ markdown, assets: [] })).toBe(markdown);
  });

  it("keeps the alt text an image already carried", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![the setup](vault/diagram.png)`,
        assets: [{ sourceLocator: "vault/diagram.png", url: MIRRORED }],
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
            sourceLocator: "attachments/report.docx",
            url: MIRRORED,
            sourcePath: "attachments/report.docx",
          },
        ],
      }),
    ).toBe(`[report.docx](${MIRRORED})`);
  });

  it("embeds any image type, matching what Roam does with a native upload", () => {
    // Verified against `file.upload`: Roam takes the first part of the MIME type, so
    // every `image/*` embeds, `.psd` included. Rendering it as a link here would make
    // the same file look different depending on how it arrived in the graph.
    expect(
      rewriteAssetLinks({
        markdown: `[](vault/layers.psd)`,
        assets: [
          {
            sourceLocator: "vault/layers.psd",
            url: MIRRORED,
            sourcePath: "vault/layers.psd",
            mimetype: "image/vnd.adobe.photoshop",
          },
        ],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("knows every extension a renderable type claims, not just the common spelling", () => {
    // `.qt` is video/quicktime just as `.mov` is, so listing one and not the other is an
    // accident the extension table should not be able to have.
    expect(
      rewriteAssetLinks({
        markdown: `[](vault/clip.qt)`,
        assets: [{ sourceLocator: "vault/clip.qt", url: MIRRORED }],
      }),
    ).toBe(`{{[[video]]: ${MIRRORED}}}`);
  });

  it("still resolves every extension the renderer depends on", () => {
    // A guard rather than a new behaviour. The table is indexed from all of `mime-db`,
    // so nothing here is hand-written and nothing pins these extensions except this
    // test: a change in the data, or in how it is indexed, would silently degrade a
    // common asset to a labelled link.
    const shapeFor: Record<string, (url: string) => string> = {
      image: (url) => `![](${url})`,
      pdf: (url) => `{{[[pdf]]: ${url}}}`,
      audio: (url) => `{{[[audio]]: ${url}}}`,
      video: (url) => `{{[[video]]: ${url}}}`,
    };
    const expected: Record<string, keyof typeof shapeFor> = {
      png: "image",
      jpg: "image",
      jpeg: "image",
      gif: "image",
      webp: "image",
      svg: "image",
      bmp: "image",
      avif: "image",
      heic: "image",
      tiff: "image",
      ico: "image",
      pdf: "pdf",
      mp3: "audio",
      wav: "audio",
      ogg: "audio",
      m4a: "audio",
      flac: "audio",
      aac: "audio",
      mp4: "video",
      webm: "video",
      mov: "video",
      m4v: "video",
      mkv: "video",
      avi: "video",
    };
    for (const [extension, kind] of Object.entries(expected)) {
      const sourceLocator = `vault/file.${extension}`;
      expect(
        rewriteAssetLinks({
          markdown: `[](${sourceLocator})`,
          assets: [{ sourceLocator, url: MIRRORED }],
        }),
      ).toBe(shapeFor[kind]?.(MIRRORED));
    }
  });

  it("keeps a deliberate link's text for every kind, not only images", () => {
    // Roam's media embeds carry no text, so embedding a link would delete the only words
    // the reader sees. That is true of a PDF exactly as it is of an image.
    expect(
      rewriteAssetLinks({
        markdown: `[Read the protocol](notes/report.pdf)`,
        assets: [{ sourceLocator: "notes/report.pdf", url: MIRRORED }],
      }),
    ).toBe(`[Read the protocol](${MIRRORED})`);
    expect(
      rewriteAssetLinks({
        markdown: `[Listen here](a.mp3)`,
        assets: [{ sourceLocator: "a.mp3", url: MIRRORED }],
      }),
    ).toBe(`[Listen here](${MIRRORED})`);
  });

  it("keeps a wikilink's alias as the link text", () => {
    // `[[x]]` is a link in Obsidian, not an embed, and the alias is the author's words.
    expect(
      rewriteAssetLinks({
        markdown: `[[vault/d.png|Figure 3]]`,
        assets: [{ sourceLocator: "vault/d.png", url: MIRRORED }],
      }),
    ).toBe(`[Figure 3](${MIRRORED})`);
    expect(
      rewriteAssetLinks({
        markdown: `[[notes/report.docx|the protocol]]`,
        assets: [
          {
            sourceLocator: "notes/report.docx",
            url: MIRRORED,
            sourcePath: "notes/report.docx",
          },
        ],
      }),
    ).toBe(`[the protocol](${MIRRORED})`);
  });

  it("ignores an image embed's pipe, which sizes rather than names", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[img.png|300]]`,
        assets: [{ sourceLocator: "img.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  /**
   * Obsidian's pipe means a width on an image embed and a label on anything else. Roam
   * renders a non-media asset as a labelled link, so the label has somewhere to go, and
   * dropping it would replace the author's words with a filename.
   */
  it("keeps a non-media embed's pipe, which names rather than sizes", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[notes/report.docx|the protocol]]`,
        assets: [{ sourceLocator: "notes/report.docx", url: MIRRORED }],
      }),
    ).toBe(`[the protocol](${MIRRORED})`);
  });

  it("falls back to the recorded name when a non-media embed has no pipe", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[notes/report.docx]]`,
        assets: [{ sourceLocator: "notes/report.docx", url: MIRRORED }],
      }),
    ).toBe(`[report.docx](${MIRRORED})`);
  });

  it("does not let a bracket in a recorded name break the link", () => {
    // `Paper [draft].pdf` is an ordinary attachment name. Emitted raw it ends the label
    // early and the rest of the link leaks into the page as literal text.
    const rewritten = rewriteAssetLinks({
      markdown: `[](x.docx)`,
      assets: [
        {
          sourceLocator: "x.docx",
          url: MIRRORED,
          sourcePath: "Paper [draft].docx",
        },
      ],
    });
    expect(rewritten).toBe(`[Paper draft.docx](${MIRRORED})`);
  });

  it("reads a recorded MIME type that carries case or parameters", () => {
    // `mimetype` comes from a `FileReference` row, not from `mime-db`, so it is not
    // normalised for us. An exact-match miss here silently drops to the extension rank.
    expect(
      rewriteAssetLinks({
        markdown: `[](vault/d.png)`,
        assets: [
          {
            sourceLocator: "vault/d.png",
            url: MIRRORED,
            mimetype: "IMAGE/PNG",
          },
        ],
      }),
    ).toBe(`![](${MIRRORED})`);
    expect(
      rewriteAssetLinks({
        markdown: `[](vault/notes)`,
        assets: [
          {
            sourceLocator: "vault/notes",
            url: MIRRORED,
            mimetype: "application/pdf; charset=binary",
          },
        ],
      }),
    ).toBe(`{{[[pdf]]: ${MIRRORED}}}`);
  });

  it("leaves an external link untouched, because no row matches it", () => {
    const markdown = `See [the paper](${EXTERNAL}) and ![](${EXTERNAL})`;
    expect(
      rewriteAssetLinks({
        markdown,
        assets: [{ sourceLocator: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(markdown);
  });

  it("uses Roam's own embed syntax for media types", () => {
    const assets = [
      { sourceLocator: "a.pdf", url: MIRRORED, mimetype: "application/pdf" },
      { sourceLocator: "b.mp3", url: OTHER_MIRRORED },
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
          {
            sourceLocator: published,
            url: MIRRORED,
            sourcePath: "protocol.pdf",
          },
        ],
      }),
    ).toBe(`Protocol: {{[[pdf]]: ${MIRRORED}}}`);
  });

  it("rewrites an Obsidian wikilink embed", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[attachments/scan.png]]`,
        assets: [{ sourceLocator: "attachments/scan.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("leaves a page reference alone, since a page name is not a recorded locator", () => {
    const markdown = `Supported by [[EVD]] - Rasch & Born 2013`;
    expect(
      rewriteAssetLinks({
        markdown,
        assets: [{ sourceLocator: "vault/diagram.png", url: MIRRORED }],
      }),
    ).toBe(markdown);
  });

  it("rewrites every occurrence of a locator the content repeats", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![](a.png)\n\nand again ![](a.png)`,
        assets: [{ sourceLocator: "a.png", url: MIRRORED }],
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
        { sourceLocator: published, url: MIRRORED, sourcePath: "report.docx" },
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
            sourceLocator: "notes/report.docx",
            url: MIRRORED,
            sourcePath: "report.docx",
          },
        ],
      }),
    ).toBe(`[the protocol](${MIRRORED})`);
  });

  it("falls back to the locator's own name when nothing was recorded", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[](notes/report.docx)`,
        assets: [{ sourceLocator: "notes/report.docx", url: MIRRORED }],
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
        assets: [{ sourceLocator: asset, url: MIRRORED }],
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
          { sourceLocator: asset, url: MIRRORED, sourcePath: "report.docx" },
        ],
      }),
    ).toBe(`See [report.docx](${MIRRORED}), then stop.`);
  });

  it("rewrites an image nested in a link without swallowing the outer bracket", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[![diagram](vault/d.png)](https://source.example)`,
        assets: [{ sourceLocator: "vault/d.png", url: MIRRORED }],
      }),
    ).toBe(`[![diagram](${MIRRORED})](https://source.example)`);
  });

  it("matches a percent-encoded locator against the decoded path Obsidian recorded", () => {
    // The note holds the encoded form; `metadataCache` gives the publisher the decoded
    // one, so every vault path with a space in it arrives spelled two ways.
    expect(
      rewriteAssetLinks({
        markdown: `![](my%20folder/d.png)`,
        assets: [{ sourceLocator: "my folder/d.png", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("embeds a type the extension list does not know, because the markdown embedded it", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[photo.avif]]`,
        assets: [{ sourceLocator: "photo.avif", url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("embeds a storage URL carrying no extension at all", () => {
    const asset =
      "https://firebasestorage.googleapis.com/v0/b/f/o/abc?alt=media&token=1";

    expect(
      rewriteAssetLinks({
        markdown: `![](${asset})`,
        assets: [{ sourceLocator: asset, url: MIRRORED }],
      }),
    ).toBe(`![](${MIRRORED})`);
  });

  it("keeps the visible text of a deliberate link to an image", () => {
    // Roam renders no alt text, so embedding this would delete the words "Figure 3".
    expect(
      rewriteAssetLinks({
        markdown: `[Figure 3](vault/d.png)`,
        assets: [{ sourceLocator: "vault/d.png", url: MIRRORED }],
      }),
    ).toBe(`[Figure 3](${MIRRORED})`);
  });

  it("labels a file whose recorded name is empty from its locator", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[](notes/report.docx)`,
        assets: [
          { sourceLocator: "notes/report.docx", url: MIRRORED, sourcePath: "" },
        ],
      }),
    ).toBe(`[report.docx](${MIRRORED})`);
  });

  it("treats a locator whose extension names a prototype member as an unknown type", () => {
    // Not the assertion it looks like: the point is that the literal string `undefined`
    // never reaches the page. An unknown extension is a file, like any other.
    expect(
      rewriteAssetLinks({
        markdown: `![](vault/odd.constructor)`,
        assets: [{ sourceLocator: "vault/odd.constructor", url: MIRRORED }],
      }),
    ).toBe(`[odd.constructor](${MIRRORED})`);
  });

  it("keeps the type a Roam media embed declared, which its storage URL cannot show", () => {
    const asset =
      "https://firebasestorage.googleapis.com/v0/b/f/o/abc?alt=media&token=1";

    expect(
      rewriteAssetLinks({
        markdown: `{{[[pdf]]: ${asset}}}`,
        assets: [{ sourceLocator: asset, url: MIRRORED }],
      }),
    ).toBe(`{{[[pdf]]: ${MIRRORED}}}`);
    expect(
      rewriteAssetLinks({
        markdown: `{{audio: ${asset}}}`,
        assets: [{ sourceLocator: asset, url: MIRRORED }],
      }),
    ).toBe(`{{[[audio]]: ${MIRRORED}}}`);
  });

  it("keeps a non-media wikilink embed a labelled link, so its name survives", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[notes/report.docx]]`,
        assets: [{ sourceLocator: "notes/report.docx", url: MIRRORED }],
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
      sourceLocator: asset.sourceRef,
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
    // never stored, so the locator stays exactly as published. That is the degradation path.
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
