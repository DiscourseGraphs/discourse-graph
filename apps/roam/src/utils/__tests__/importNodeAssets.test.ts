import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { importNodeAssets } from "../importNodeAssets";
import { mirrorAssetToRoamStorage } from "../mirrorAssetToRoamStorage";

vi.mock("../mirrorAssetToRoamStorage", () => ({
  mirrorAssetToRoamStorage: vi.fn(),
}));

const mirror = vi.mocked(mirrorAssetToRoamStorage);

const IMAGE_REF = "attachments/diagram.png";
const FILE_REF = "attachments/report.docx";
const MIRRORED = "https://firebasestorage.googleapis.com/v0/b/f/o/x?alt=media";

const sharedNode = {
  rid: "orn:obsidian.note:vault-a/node-1",
  sourceLocalId: "node-1",
  spaceId: 20,
  spaceName: "Vault A",
  spaceUri: "obsidian:vault-a",
  platform: "Obsidian",
  title: "REM sleep and recall",
  created: null,
  lastModified: "2026-06-14T15:00:00.000Z",
  directMetadata: null,
} as unknown as SharedNode;

type Row = { filepath: string; filehash: string; source_path: string | null };

const clientWithReferences = (
  rows: Row[],
  error?: { message: string },
): { client: DGSupabaseClient; from: ReturnType<typeof vi.fn> } => {
  const result = error ? { data: null, error } : { data: rows, error: null };
  const chain = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  const from = vi.fn(() => ({ select: vi.fn(() => chain) }));
  return { client: { from } as unknown as DGSupabaseClient, from };
};

const row = (
  filepath: string,
  hash: string,
  sourcePath: string | null = null,
): Row => ({
  filepath,
  filehash: hash,
  source_path: sourcePath,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importNodeAssets", () => {
  it("points the markdown at this graph's copies and counts what it uploaded", async () => {
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: "h1",
      url: MIRRORED,
    });

    const result = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1")]).client,
      sharedNode,
      markdown: `![](${IMAGE_REF})`,
    });

    expect(result.markdown).toBe(`![](${MIRRORED})`);
    expect(result.report).toEqual({
      mirrored: 1,
      reused: 0,
      skipped: [],
      failed: [],
    });
  });

  it("counts a copy this graph already held separately from one it uploaded", async () => {
    mirror.mockResolvedValue({
      status: "reused",
      contentHash: "h1",
      url: MIRRORED,
    });

    const { report } = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1")]).client,
      sharedNode,
      markdown: `![](${IMAGE_REF})`,
    });

    expect(report).toMatchObject({ mirrored: 0, reused: 1 });
  });

  it("passes the recorded name through, so a non-media link can be labelled", async () => {
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: "h2",
      url: MIRRORED,
    });

    const result = await importNodeAssets({
      client: clientWithReferences([row(FILE_REF, "h2", "report.docx")]).client,
      sharedNode,
      markdown: `[](${FILE_REF})`,
    });

    expect(mirror).toHaveBeenCalledWith(
      expect.objectContaining({ contentHash: "h2", sourcePath: "report.docx" }),
    );
    expect(result.markdown).toBe(`[report.docx](${MIRRORED})`);
  });

  it("imports the node with its content intact when one asset fails", async () => {
    mirror
      .mockResolvedValueOnce({
        status: "mirrored",
        contentHash: "h1",
        url: MIRRORED,
      })
      .mockRejectedValueOnce(new Error("upload refused"));

    const markdown = `![](${IMAGE_REF}) and [](${FILE_REF})`;
    const result = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1"), row(FILE_REF, "h2")])
        .client,
      sharedNode,
      markdown,
    });

    // A failed asset is marked rather than breaking the node.
    expect(result.markdown).toBe(
      `![](${MIRRORED}) and [Failed to import](${FILE_REF})`,
    );
    expect(result.report.mirrored).toBe(1);
    expect(result.report.failed).toEqual([
      { sourceLocator: FILE_REF, message: "upload refused" },
    ]);
  });

  it("reports an oversized asset and marks its link", async () => {
    mirror.mockResolvedValue({
      status: "skipped",
      contentHash: "h1",
      reason: "too-large",
      size: 9_000_000,
      limit: 6_291_456,
    });

    const result = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1")]).client,
      sharedNode,
      markdown: `![](${IMAGE_REF})`,
    });

    expect(result.markdown).toBe(`[Too large for import](${IMAGE_REF})`);
    expect(result.report.skipped).toEqual([
      {
        sourceLocator: IMAGE_REF,
        reason: "too-large",
        size: 9_000_000,
        limit: 6_291_456,
      },
    ]);
  });

  it("imports a node whose every asset fails, reporting each one", async () => {
    mirror.mockRejectedValue(new Error("storage unreachable"));

    const result = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1"), row(FILE_REF, "h2")])
        .client,
      sharedNode,
      markdown: `![](${IMAGE_REF}) and [](${FILE_REF})`,
    });

    expect(result.markdown).toBe(
      `[Failed to import](${IMAGE_REF}) and [Failed to import](${FILE_REF})`,
    );
    expect(result.report.failed).toHaveLength(2);
  });

  // Without the rows no link can be marked, so the node fails and the next import retries.
  it("throws when the references cannot be read", async () => {
    await expect(
      importNodeAssets({
        client: clientWithReferences([], { message: "permission denied" })
          .client,
        sharedNode,
        markdown: `![](${IMAGE_REF})`,
      }),
    ).rejects.toMatchObject({ message: "permission denied" });
    expect(mirror).not.toHaveBeenCalled();
  });

  it("marks failed and oversized assets among copied ones, each at its own link", async () => {
    mirror
      .mockRejectedValueOnce(new Error("upload refused"))
      .mockResolvedValueOnce({
        status: "mirrored",
        contentHash: "h2",
        url: MIRRORED,
      })
      .mockResolvedValueOnce({
        status: "skipped",
        contentHash: "h3",
        reason: "too-large",
        size: 9_000_000,
        limit: 6_291_456,
      });

    // Rows are fetched ordered by filepath, so this is the order they are mirrored in.
    const result = await importNodeAssets({
      client: clientWithReferences([
        row("a/first.png", "h1"),
        row("b/second.png", "h2"),
        row("c/third.pdf", "h3"),
      ]).client,
      sharedNode,
      markdown: `![[a/first.png]] ![the second](b/second.png) [[c/third.pdf|the paper]]`,
    });

    expect(result.markdown).toBe(
      `[Failed to import](a/first.png) ![the second](${MIRRORED}) [the paper (Too large for import)](c/third.pdf)`,
    );
  });

  // This locator would render as it is, but skipping the copy would leave the page
  // depending on a blob the origin graph's owner can delete.
  it("stores its own copy of a Roam-origin asset rather than passing the origin URL through", async () => {
    const originUrl =
      "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FOriginGraph%2FlqP2ioVNC3.png?alt=media&token=9f1c07a4";
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: "h1",
      url: MIRRORED,
    });

    const result = await importNodeAssets({
      client: clientWithReferences([
        row(originUrl, "h1", "CleanShot 2025-11-16 at 17.14.44@2x.png"),
      ]).client,
      sharedNode,
      markdown: `![](${originUrl})`,
    });

    expect(mirror).toHaveBeenCalledTimes(1);
    expect(result.markdown).toBe(`![](${MIRRORED})`);
    expect(result.markdown).not.toContain("OriginGraph");
    expect(result.report.mirrored).toBe(1);
  });

  it("copies nothing for a node with no recorded references", async () => {
    const markdown = `![](${IMAGE_REF})`;
    const result = await importNodeAssets({
      client: clientWithReferences([]).client,
      sharedNode,
      markdown,
    });

    expect(result.markdown).toBe(markdown);
    expect(result.report).toEqual({
      mirrored: 0,
      reused: 0,
      skipped: [],
      failed: [],
    });
    expect(mirror).not.toHaveBeenCalled();
  });

  it("hands each caller its own report, so one node's failure is not another's", async () => {
    const first = await importNodeAssets({
      client: clientWithReferences([]).client,
      sharedNode,
      markdown: "no assets here",
    });
    const second = await importNodeAssets({
      client: clientWithReferences([]).client,
      sharedNode,
      markdown: "none here either",
    });

    first.report.failed.push({ sourceLocator: "x", message: "mine alone" });

    expect(second.report.failed).toEqual([]);
  });

  // The mock returns `mirrored` on every call, as the real one does after a failed registry
  // write, so only the loop's own memo stops the second upload.
  it("uploads identical bytes once when two locators name them", async () => {
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: "h1",
      url: MIRRORED,
    });

    const { markdown, report } = await importNodeAssets({
      client: clientWithReferences([
        row(IMAGE_REF, "h1"),
        row("attachments/copy.png", "h1"),
      ]).client,
      sharedNode,
      markdown: `![](${IMAGE_REF}) ![](attachments/copy.png)`,
    });

    expect(mirror).toHaveBeenCalledTimes(1);
    expect(markdown).toBe(`![](${MIRRORED}) ![](${MIRRORED})`);
    // Not `reused: 1`: this run uploaded those bytes itself a moment earlier.
    expect(report).toMatchObject({ mirrored: 1, reused: 0 });
  });

  it("asks once whether a blob is oversized, and reports every locator naming it", async () => {
    mirror.mockResolvedValue({
      status: "skipped",
      contentHash: "h1",
      reason: "too-large",
      size: 9_000_000,
      limit: 6_291_456,
    });

    const markdown = `![](${IMAGE_REF}) ![](attachments/copy.png)`;
    const { report } = await importNodeAssets({
      client: clientWithReferences([
        row(IMAGE_REF, "h1"),
        row("attachments/copy.png", "h1"),
      ]).client,
      sharedNode,
      markdown,
    });

    // Decided once per hash, so the second locator adds no round trip.
    expect(mirror).toHaveBeenCalledTimes(1);
    // Still one entry per locator.
    expect(report.skipped).toEqual([
      {
        sourceLocator: IMAGE_REF,
        reason: "too-large",
        size: 9_000_000,
        limit: 6_291_456,
      },
      {
        sourceLocator: "attachments/copy.png",
        reason: "too-large",
        size: 9_000_000,
        limit: 6_291_456,
      },
    ]);
  });

  it("copies nothing for a reference the fetched markdown never makes", async () => {
    const { client } = clientWithReferences([
      row("attachments/only-in-frontmatter.png", "h1"),
    ]);

    const { report } = await importNodeAssets({
      client,
      sharedNode,
      markdown: "A body that mentions no assets at all.",
    });

    // The row outlived its locator: stripped frontmatter, or a publish whose cleanup
    // failed. Uploading it would spend the user's storage on bytes nothing references.
    expect(mirror).not.toHaveBeenCalled();
    expect(report).toMatchObject({ mirrored: 0, reused: 0 });
  });

  it("copies a reference the markdown percent-encodes", async () => {
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: "h1",
      url: MIRRORED,
    });

    const result = await importNodeAssets({
      client: clientWithReferences([row("my folder/d.png", "h1")]).client,
      sharedNode,
      markdown: `![](my%20folder/d.png)`,
    });

    expect(mirror).toHaveBeenCalledTimes(1);
    expect(result.markdown).toBe(`![](${MIRRORED})`);
  });

  it("copies a reference whose name forces an encoding encodeURI would not apply", async () => {
    // `fig#1.png` is written `fig%231.png`, since `#` starts a fragment. Deriving the
    // spellings forward would miss it; reading the rewriter's own locators cannot.
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: "h1",
      url: MIRRORED,
    });

    const result = await importNodeAssets({
      client: clientWithReferences([row("fig#1.png", "h1")]).client,
      sharedNode,
      markdown: `![](fig%231.png)`,
    });

    expect(mirror).toHaveBeenCalledTimes(1);
    expect(result.markdown).toBe(`![](${MIRRORED})`);
  });

  it("copies nothing for a node with no content", async () => {
    const { client, from } = clientWithReferences([row(IMAGE_REF, "h1")]);
    const result = await importNodeAssets({ client, sharedNode, markdown: "" });

    expect(result.markdown).toBe("");
    // Not even the reference query runs: there is nothing a rewrite could apply to.
    expect(from).not.toHaveBeenCalled();
  });
});
