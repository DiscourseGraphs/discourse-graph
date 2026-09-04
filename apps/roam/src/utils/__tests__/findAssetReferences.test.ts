import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findAssetReferences, isRoamStorageUrl } from "../findAssetReferences";

const GRAPH_NAME = "MAPLab";

/** The graph name is read per call, so a plain stub is enough. */
beforeEach(() => {
  vi.stubGlobal("window", { roamAlphaAPI: { graph: { name: GRAPH_NAME } } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const roamAsset = (name: string) =>
  `https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2F${name}?alt=media&token=9f1c07a4-2b3e-4c5d-8a91-6e0f2d7b4c13`;

const IMAGE = roamAsset("lqP2ioVNC3.png");
const PDF = roamAsset("GVfB6XBcMR.pdf");
const AUDIO = roamAsset("Kd8xTbQ1Ln.mp3");
const VIDEO = roamAsset("Zr4mWpN70c.mp4");
const DOCX = roamAsset("Vx9sLcE22a.docx");

describe("findAssetReferences", () => {
  it("finds an image embed", () => {
    expect(findAssetReferences(`Some text\n\n![](${IMAGE})\n`)).toEqual([
      IMAGE,
    ]);
    expect(findAssetReferences(`![a diagram](${IMAGE})`)).toEqual([IMAGE]);
  });

  it("finds the non-image embeds Roam writes", () => {
    expect(findAssetReferences(`{{[[pdf]]: ${PDF}}}`)).toEqual([PDF]);
    expect(findAssetReferences(`{{[[audio]]: ${AUDIO}}}`)).toEqual([AUDIO]);
    expect(findAssetReferences(`{{[[video]]: ${VIDEO}}}`)).toEqual([VIDEO]);
  });

  it("finds a non-image embed written without the page brackets", () => {
    expect(findAssetReferences(`{{pdf: ${PDF}}}`)).toEqual([PDF]);
  });

  it("finds a bare URL", () => {
    expect(findAssetReferences(`Protocol: ${DOCX}`)).toEqual([DOCX]);
  });

  it("finds a file linked rather than embedded", () => {
    expect(findAssetReferences(`See [the protocol](${DOCX}).`)).toEqual([DOCX]);
  });

  it("ignores an external link", () => {
    const markdown = [
      "See [Rasch & Born 2013](https://www.science.org/doi/10.1126/science.1234567).",
      "![hotlinked](https://example.com/someone-elses.png)",
      "https://roamresearch.com/#/app/MAPLab/page/tgWb6JozF",
    ].join("\n");
    expect(findAssetReferences(markdown)).toEqual([]);
  });

  it("keeps Roam-hosted assets while ignoring external links around them", () => {
    const markdown = [
      `![](${IMAGE})`,
      "[a paper](https://example.com/paper.pdf)",
      `{{[[pdf]]: ${PDF}}}`,
    ].join("\n\n");
    expect(findAssetReferences(markdown)).toEqual([IMAGE, PDF]);
  });

  it("counts an asset once however often it appears, in order of first appearance", () => {
    const markdown = `![](${PDF})\n\n![](${IMAGE})\n\n{{[[pdf]]: ${PDF}}}\n\n${IMAGE}`;
    expect(findAssetReferences(markdown)).toEqual([PDF, IMAGE]);
  });

  it("does not double count a URL that sits inside an embed", () => {
    expect(findAssetReferences(`![](${IMAGE})`)).toHaveLength(1);
  });

  it("drops sentence punctuation that follows a bare URL", () => {
    expect(findAssetReferences(`The protocol is at ${DOCX}.`)).toEqual([DOCX]);
  });

  it("returns nothing for content with no assets", () => {
    expect(findAssetReferences("# A title\n\nJust prose.\n")).toEqual([]);
    expect(findAssetReferences("")).toEqual([]);
  });
});

describe("isRoamStorageUrl", () => {
  it("accepts a Roam upload", () => {
    expect(isRoamStorageUrl(IMAGE)).toBe(true);
  });

  it("accepts an upload in another bucket under this graph's path", () => {
    // The bucket is deliberately not checked. This is the accepted risk:
    // a URL shaped like ours in a bucket we do not control is copied.
    expect(
      isRoamStorageUrl(
        `https://firebasestorage.googleapis.com/v0/b/someone-else.appspot.com/o/imgs%2Fapp%2F${GRAPH_NAME}%2FlqP2ioVNC3.png?alt=media`,
      ),
    ).toBe(true);
  });

  it("rejects another graph's asset, whatever the bucket", () => {
    expect(
      isRoamStorageUrl(
        "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FOtherGraph%2FlqP2ioVNC3.png?alt=media",
      ),
    ).toBe(false);
  });

  it("rejects a path outside the graph's asset folder", () => {
    expect(
      isRoamStorageUrl(
        "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fx.png?alt=media",
      ),
    ).toBe(false);
  });

  it("rejects the folder itself, with no file named", () => {
    expect(
      isRoamStorageUrl(
        `https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2F${GRAPH_NAME}%2F?alt=media`,
      ),
    ).toBe(false);
  });

  it("matches the graph name exactly, since casing is preserved in the URL", () => {
    expect(
      isRoamStorageUrl(
        "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fmaplab%2FlqP2ioVNC3.png?alt=media",
      ),
    ).toBe(false);
  });

  it("rejects a lookalike host", () => {
    expect(
      isRoamStorageUrl(
        "https://firebasestorage.googleapis.com.evil.test/v0/b/firescript-577a2.appspot.com/o/x.png",
      ),
    ).toBe(false);
  });

  it("rejects anything that is not a URL", () => {
    expect(isRoamStorageUrl("attachments/figure.png")).toBe(false);
    expect(isRoamStorageUrl("")).toBe(false);
  });
});
