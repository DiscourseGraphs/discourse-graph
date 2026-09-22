import { describe, expect, it } from "vitest";
import {
  obsidianOriginNodeExample,
  roamOriginNodeExample,
} from "@repo/database/crossAppNodeContract.example";
import {
  collectAssetLocators,
  FAILED_IMPORT_MARKER,
  lookupCandidates,
  rewriteAssetLinks,
  TOO_LARGE_MARKER,
  type UnresolvedAsset,
} from "../rewriteAssetLinks";

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

  // Obsidian emits this CommonMark form for a vault path with spaces. The brackets
  // delimit the locator, so the recorded row matches the text between them.
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

  // Leftover `<` and `>` around a rewritten link render as text in Roam.
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
    // A bare URL's visible text is the URL, which says nothing about the file.
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
    // Verified against `file.upload`: Roam branches on the first part of the MIME type,
    // so every `image/*` embeds, `.psd` included.
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
    // `.qt` is video/quicktime just as `.mov` is.
    expect(
      rewriteAssetLinks({
        markdown: `[](vault/clip.qt)`,
        assets: [{ sourceLocator: "vault/clip.qt", url: MIRRORED }],
      }),
    ).toBe(`{{[[video]]: ${MIRRORED}}}`);
  });

  it("still resolves every extension the renderer depends on", () => {
    // The table is indexed from `mime-db`, so only this test pins these extensions: a
    // change in the data would silently degrade a common asset to a labelled link.
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
    // Roam's media embeds carry no text, a PDF's as much as an image's.
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
    // `[[x]]` is a link in Obsidian, not an embed.
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

  // A non-media asset renders as a labelled link, so the pipe's label has somewhere to go.
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
    // Emitted raw, the bracket ends the label early and the rest of the link leaks into
    // the page as literal text.
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
    // A `FileReference` row is not normalised for us, and a miss here silently drops to
    // the extension rank.
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

  // A Roam-origin non-media asset arrives as a bare storage URL, so the recorded name is
  // all a reader has to go on.
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
    // `findAssetReferences` strips this before writing `filepath`, so a lookup that did
    // not would leave the page pointing at the origin graph's storage.
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
    // The note holds the encoded form and `metadataCache` the decoded one, so a vault path
    // with a space arrives spelled two ways.
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
    // The point is that the literal string `undefined` never reaches the page.
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

describe("marking an asset this graph holds no copy of", () => {
  const ORIGIN =
    "https://firebasestorage.googleapis.com/v0/b/f.appspot.com/o/origin?alt=media&token=abc";
  const failed = (sourceLocator: string): UnresolvedAsset => ({
    sourceLocator,
    marker: FAILED_IMPORT_MARKER,
  });
  const tooLarge = (sourceLocator: string): UnresolvedAsset => ({
    sourceLocator,
    marker: TOO_LARGE_MARKER,
  });

  it("marks a vault path without a label with the marker alone", () => {
    for (const markdown of [
      `![](vault/d.png)`,
      `[](vault/d.png)`,
      `![[vault/d.png]]`,
      `[[vault/d.png]]`,
    ])
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [],
          unresolved: [failed("vault/d.png")],
        }),
      ).toBe(`[Failed to import](vault/d.png)`);
  });

  it("keeps a vault path's label next to the marker", () => {
    const unresolved = [tooLarge("vault/report.docx")];
    for (const markdown of [
      `![the report](vault/report.docx)`,
      `[the report](vault/report.docx)`,
      `![[vault/report.docx|the report]]`,
      `[[vault/report.docx|the report]]`,
    ])
      expect(rewriteAssetLinks({ markdown, assets: [], unresolved })).toBe(
        `[the report (Too large for import)](vault/report.docx)`,
      );
  });

  it("does not read an image embed's width as a label", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![[vault/d.png|300]]`,
        assets: [],
        unresolved: [failed("vault/d.png")],
      }),
    ).toBe(`[Failed to import](vault/d.png)`);
  });

  it("keeps a vault path with spaces a single link destination", () => {
    for (const markdown of [
      `![](<my folder/d (1).png>)`,
      `![[my folder/d (1).png]]`,
    ])
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [],
          unresolved: [failed("my folder/d (1).png")],
        }),
      ).toBe(`[Failed to import](my%20folder/d%20%281%29.png)`);
  });

  it("keeps the label of a PDF, audio or video embed", () => {
    for (const [locator, label] of [
      ["vault/a.pdf", "the paper"],
      ["vault/a.mp3", "the talk"],
      ["vault/a.mp4", "the demo"],
    ])
      expect(
        rewriteAssetLinks({
          markdown: `![[${locator}|${label}]]`,
          assets: [],
          unresolved: [failed(locator)],
        }),
      ).toBe(`[${label} (Failed to import)](${locator})`);
  });

  it("does not read an embed's size as a label, whatever the kind", () => {
    for (const [locator, size] of [
      ["vault/a.mp4", "640"],
      ["vault/a.png", "300x200"],
    ])
      expect(
        rewriteAssetLinks({
          markdown: `![[${locator}|${size}]]`,
          assets: [],
          unresolved: [failed(locator)],
        }),
      ).toBe(`[Failed to import](${locator})`);
  });

  it("keeps a destination the source already percent-encoded", () => {
    for (const [markdown, recorded, destination] of [
      [`![](fig%231.png)`, "fig#1.png", "fig%231.png"],
      [`![](vault/100%25.png)`, "vault/100%.png", "vault/100%25.png"],
    ])
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [],
          unresolved: [failed(recorded)],
        }),
      ).toBe(`[Failed to import](${destination})`);
  });

  it("encodes a path the source spelled raw", () => {
    for (const [markdown, recorded, destination] of [
      [`![](<fig#1.png>)`, "fig#1.png", "fig%231.png"],
      [`![[vault/100%.png]]`, "vault/100%.png", "vault/100%25.png"],
      [`[[what?.png]]`, "what?.png", "what%3F.png"],
    ])
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [],
          unresolved: [failed(recorded)],
        }),
      ).toBe(`[Failed to import](${destination})`);
  });

  it("marks an image inside a link without nesting one link in another", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[![alt](vault/d.png)](https://x.org)`,
        assets: [],
        unresolved: [failed("vault/d.png")],
      }),
    ).toBe(`[alt (Failed to import)](https://x.org)`);
    expect(
      rewriteAssetLinks({
        markdown: `[![alt](${ORIGIN})](https://x.org)`,
        assets: [],
        unresolved: [failed(ORIGIN)],
      }),
    ).toBe(`[![alt](${ORIGIN}) (Failed to import)](https://x.org)`);
    expect(
      rewriteAssetLinks({
        markdown: `[see ![alt](vault/d.png) here](https://x.org)`,
        assets: [],
        unresolved: [failed("vault/d.png")],
      }),
    ).toBe(`[see alt (Failed to import) here](https://x.org)`);
  });

  it("marks every image in one link label, as in a row of badges", () => {
    for (const [markdown, expected] of [
      [
        `[see ![a](vault/d.png) and ![b](vault/d.png)](https://x.org)`,
        `[see a (Failed to import) and b (Failed to import)](https://x.org)`,
      ],
      [
        `[![a](vault/d.png)![b](vault/d.png)](https://x.org)`,
        `[a (Failed to import)b (Failed to import)](https://x.org)`,
      ],
    ])
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [],
          unresolved: [failed("vault/d.png")],
        }),
      ).toBe(expected);
  });

  it("keeps an image's link when a bracket before it opens no link", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[![alt](vault/d.png) plain bracket`,
        assets: [],
        unresolved: [failed("vault/d.png")],
      }),
    ).toBe(`[[alt (Failed to import)](vault/d.png) plain bracket`);
  });

  it("keeps a Roam-origin reference as published and puts the marker after it", () => {
    for (const markdown of [
      `![a figure](${ORIGIN})`,
      `[the protocol](${ORIGIN})`,
      `{{[[pdf]]: ${ORIGIN}}}`,
      `{{audio: ${ORIGIN}}}`,
      ORIGIN,
      `<${ORIGIN}>`,
    ])
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [],
          unresolved: [tooLarge(ORIGIN)],
        }),
      ).toBe(`${markdown} (Too large for import)`);
  });

  it("keeps a sentence's punctuation after the marker of a bare URL", () => {
    expect(
      rewriteAssetLinks({
        markdown: `See ${ORIGIN}, then stop.`,
        assets: [],
        unresolved: [failed(ORIGIN)],
      }),
    ).toBe(`See ${ORIGIN} (Failed to import), then stop.`);
  });

  it("strips brackets from a label it keeps", () => {
    expect(
      rewriteAssetLinks({
        markdown: `[[vault/d.docx|Paper [draft]]]`,
        assets: [],
        unresolved: [failed("vault/d.docx")],
      }),
    ).toContain(`(Failed to import)](vault/d.docx)`);
  });

  it("rewrites copied assets and marks the rest in one pass, in any order", () => {
    expect(
      rewriteAssetLinks({
        markdown: `![](a.png) ![](b.png) ![](c.png) ![](d.png)`,
        assets: [
          { sourceLocator: "b.png", url: MIRRORED },
          { sourceLocator: "d.png", url: OTHER_MIRRORED },
        ],
        unresolved: [failed("a.png"), tooLarge("c.png")],
      }),
    ).toBe(
      `[Failed to import](a.png) ![](${MIRRORED}) [Too large for import](c.png) ![](${OTHER_MIRRORED})`,
    );
  });

  it("leaves a link alone when it is neither copied nor marked", () => {
    const markdown = `![](vault/other.png) and [[EVD]]`;
    expect(
      rewriteAssetLinks({
        markdown,
        assets: [],
        unresolved: [failed("vault/d.png")],
      }),
    ).toBe(markdown);
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
    // The second asset is absent from `assets`, as an uncopied one would be: its locator
    // stays as published. That is the degradation path.
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

/**
 * Pins what `collectAssetLocators` promises: the locators a caller can see are the ones
 * the rewrite will act on.
 *
 * The corpus carries one of every branch `LINK_PATTERN` lists, so a capture-group change
 * that leaves the rewriter working still fails here. Nothing else would catch it, because
 * a divergence imports the node successfully, just wrong.
 */
describe("collectAssetLocators reads what rewriteAssetLinks acts on", () => {
  const CORPUS = [
    `![a diagram](vault/a.png)`,
    `[the report](vault/b.docx)`,
    `{{[[pdf]]: https://storage.test/c.pdf}}`,
    `{{audio: https://storage.test/d.mp3}}`,
    `![[vault/e.png]]`,
    `[[vault/f.png|Figure 6]]`,
    `See https://storage.test/g.png, then stop.`,
    `![](my%20folder/h.png)`,
    `![[vault/i.docx|a label]]`,
    `![](<my folder/j.png>)`,
    `<https://storage.test/k.png>`,
    `A page reference, [[EVD]], which no row matches.`,
  ].join("\n\n");

  // As a `FileReference` records them, which is not always as the markdown spells them:
  // the bare URL arrives with the sentence's comma attached, and Obsidian records a
  // vault path decoded.
  const RECORDED = [
    "vault/a.png",
    "vault/b.docx",
    "https://storage.test/c.pdf",
    "https://storage.test/d.mp3",
    "vault/e.png",
    "vault/f.png",
    "https://storage.test/g.png",
    "my folder/h.png",
    "vault/i.docx",
    "my folder/j.png",
    "https://storage.test/k.png",
  ];

  it("collects one locator per reference, in the order the markdown makes them", () => {
    // Written out rather than derived, so a drift in the capture groups fails here
    // instead of being absorbed by whatever derived it.
    expect(collectAssetLocators(CORPUS)).toEqual([
      "vault/a.png",
      "vault/b.docx",
      "https://storage.test/c.pdf",
      "https://storage.test/d.mp3",
      "vault/e.png",
      "vault/f.png",
      "https://storage.test/g.png,",
      "my%20folder/h.png",
      // The embed's alias is a group of its own, so it is never a locator.
      "vault/i.docx",
      // Angle brackets delimit the locator, so they are gone by the time it is collected.
      "my folder/j.png",
      "https://storage.test/k.png",
      "EVD",
    ]);
  });

  it("reaches every recorded locator once widened, which is what the caller filters on", () => {
    const resolvable = new Set(
      collectAssetLocators(CORPUS).flatMap(lookupCandidates),
    );
    for (const recorded of RECORDED) expect(resolvable).toContain(recorded);
  });

  it("rewrites every locator it collected, and nothing it did not", () => {
    const assets = RECORDED.map((sourceLocator, index) => ({
      sourceLocator,
      url: `https://mirror.test/${index}`,
    }));
    const result = rewriteAssetLinks({ markdown: CORPUS, assets });

    // Each asset reached its own copy, so no branch was collected but left unrewritten.
    for (const asset of assets) expect(result).toContain(asset.url);
    // And no original spelling survived, so none was rewritten only in part.
    for (const spelling of [
      "vault/a.png",
      "vault/b.docx",
      "vault/e.png",
      "vault/f.png",
      "my%20folder/h.png",
      "vault/i.docx",
      "my folder/j.png",
      "storage.test",
    ])
      expect(result).not.toContain(spelling);

    // `EVD` is collected like any other match, because this file cannot know which
    // locators have rows. Having no row is what leaves it alone.
    expect(result).toContain(`[[EVD]]`);
  });
});

/**
 * Roam stores a page as blocks, so a rewrite that reached across a line break could not be
 * repeated later against any one block's text. Both readers must therefore stop at a line
 * break, and a reference spelled across one is left as published — the same degradation as
 * an asset with no row.
 */
describe("a reference never spans a line break", () => {
  const spanning: { form: string; markdown: string; locator: string }[] = [
    {
      form: "an image's alt text",
      markdown: `![a figure\nspanning](vault/fig.png)`,
      locator: "vault/fig.png",
    },
    {
      form: "a link's label",
      markdown: `[the\npaper](vault/doc.pdf)`,
      locator: "vault/doc.pdf",
    },
    {
      form: "an angle-bracketed destination",
      markdown: `![](<my folder/fig\nbar.png>)`,
      locator: "my folder/fig\nbar.png",
    },
    {
      form: "a title following a destination",
      markdown: `![a](vault/fig.png\n"a title")`,
      locator: "vault/fig.png",
    },
    {
      form: "a wikilink embed's locator",
      markdown: `![[vault/fig\nbar.png]]`,
      locator: "vault/fig\nbar.png",
    },
    {
      form: "a wikilink's alias",
      markdown: `[[vault/doc.pdf\n|the paper]]`,
      locator: "vault/doc.pdf",
    },
  ];

  for (const { form, markdown, locator } of spanning) {
    it(`collects nothing from ${form} written across two lines`, () => {
      expect(collectAssetLocators(markdown)).toEqual([]);
    });

    it(`leaves ${form} written across two lines exactly as published`, () => {
      expect(
        rewriteAssetLinks({
          markdown,
          assets: [{ sourceLocator: locator, url: MIRRORED }],
        }),
      ).toBe(markdown);
    });
  }

  // The URL branch already stopped at a line break, so it still reaches a URL the broken
  // construct around it happens to enclose. What matters is that it reads that line the
  // same way whether the line arrives alone or inside the whole document, since that is
  // the agreement a later per-block pass depends on.
  it("reads a media embed split across lines as the bare URL its second line holds", () => {
    const secondLine = `${EXTERNAL}}}`;
    const assets = [{ sourceLocator: EXTERNAL, url: MIRRORED }];

    expect(
      rewriteAssetLinks({ markdown: `{{[[pdf]]:\n${secondLine}`, assets }),
    ).toBe(
      `{{[[pdf]]:\n${rewriteAssetLinks({ markdown: secondLine, assets })}`,
    );
  });

  // The constraint stops at the line break and no earlier: a reference sitting on its own
  // line among others is ordinary content, not a spanning one.
  it("still resolves a reference on one line of a multi-line document", () => {
    expect(
      rewriteAssetLinks({
        markdown: `first line\n![](vault/fig.png)\nlast line`,
        assets: [{ sourceLocator: "vault/fig.png", url: MIRRORED }],
      }),
    ).toBe(`first line\n![](${MIRRORED})\nlast line`);
  });
});
