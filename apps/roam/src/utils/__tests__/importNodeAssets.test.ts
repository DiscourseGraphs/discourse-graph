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

    // The resolved asset is still rewritten; the failed one keeps the token it arrived
    // with, which is the degradation path rather than a broken node.
    expect(result.markdown).toBe(`![](${MIRRORED}) and [](${FILE_REF})`);
    expect(result.report.mirrored).toBe(1);
    expect(result.report.failed).toEqual([
      { sourceRef: FILE_REF, message: "upload refused" },
    ]);
  });

  it("reports an oversized asset and leaves its token in place", async () => {
    mirror.mockResolvedValue({
      status: "skipped",
      contentHash: "h1",
      reason: "too-large",
      size: 9_000_000,
      limit: 6_291_456,
    });

    const markdown = `![](${IMAGE_REF})`;
    const result = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1")]).client,
      sharedNode,
      markdown,
    });

    expect(result.markdown).toBe(markdown);
    expect(result.report.skipped).toEqual([
      {
        sourceRef: IMAGE_REF,
        reason: "too-large",
        size: 9_000_000,
        limit: 6_291_456,
      },
    ]);
  });

  it("imports a node whose every asset fails, reporting each one", async () => {
    mirror.mockRejectedValue(new Error("storage unreachable"));

    const markdown = `![](${IMAGE_REF}) and [](${FILE_REF})`;
    const result = await importNodeAssets({
      client: clientWithReferences([row(IMAGE_REF, "h1"), row(FILE_REF, "h2")])
        .client,
      sharedNode,
      markdown,
    });

    expect(result.markdown).toBe(markdown);
    expect(result.report.failed).toHaveLength(2);
  });

  it("does not fail the node when the references cannot be read", async () => {
    const markdown = `![](${IMAGE_REF})`;
    const result = await importNodeAssets({
      client: clientWithReferences([], { message: "permission denied" }).client,
      sharedNode,
      markdown,
    });

    expect(result.markdown).toBe(markdown);
    expect(result.report.failed).toEqual([
      {
        sourceRef: sharedNode.rid,
        message: expect.stringContaining("permission denied") as string,
      },
    ]);
    expect(mirror).not.toHaveBeenCalled();
  });

  // A node published from Roam and imported into a second Roam graph. The token is a URL
  // the importing graph could render directly, and it is still resolved through its row
  // and copied: recognising a storage URL in order to skip the copy would put origin
  // detection back into the destination, and it would leave this graph's page depending
  // on a blob the origin graph's owner can delete.
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

  it("copies nothing for a node with no content", async () => {
    const { client, from } = clientWithReferences([row(IMAGE_REF, "h1")]);
    const result = await importNodeAssets({ client, sharedNode, markdown: "" });

    expect(result.markdown).toBe("");
    // Not even the reference query runs: there is nothing a rewrite could apply to.
    expect(from).not.toHaveBeenCalled();
  });
});
