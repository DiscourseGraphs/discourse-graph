import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { contentTypes } from "@repo/content-model";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { MAX_PUBLISHED_ASSET_BYTES } from "@repo/database/lib/assetLimits";
import { publishNodeAssets, summarizeAssetResults } from "../publishNodeAssets";
import { importNodeAssets } from "../importNodeAssets";
import { mirrorAssetToRoamStorage } from "../mirrorAssetToRoamStorage";

/**
 * The degradation path, followed across both transfers rather than within one.
 *
 * The published markdown of the first half is the input to the second, so what a
 * destination actually receives for an asset that never made it into shared storage is
 * asserted rather than assumed: publication reports the failure and leaves the token,
 * and import leaves that same token alone because no row matches it. The two halves are
 * covered separately in `publishNodeAssets.test.ts` and `importNodeAssets.test.ts`; what
 * is only visible here is that they agree on what passes between them.
 */

vi.mock("../mirrorAssetToRoamStorage", () => ({
  mirrorAssetToRoamStorage: vi.fn(),
}));
const mirror = vi.mocked(mirrorAssetToRoamStorage);

const roamAsset = (name: string) =>
  `https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2F${name}.png?alt=media&token=9f1c07a4`;

const STORED = roamAsset("stored");
const UNREADABLE = roamAsset("unreadable");
const OVERSIZED = roamAsset("oversized");
const EXTERNAL = "https://example.org/not-an-asset.png";

const MARKDOWN = [
  "# Sleep improves memory consolidation",
  "",
  `![](${STORED})`,
  `![](${UNREADABLE})`,
  `![](${OVERSIZED})`,
  `[a paper](${EXTERNAL})`,
  "",
  "- Supported by [[EVD]] - Rasch & Born 2013",
].join("\n");

const SOURCE_LOCAL_ID = "tgWb6JozF";

const node: CrossAppNode = {
  localId: SOURCE_LOCAL_ID,
  nodeType: "rCLM0schema",
  coreTitle: "Sleep improves memory consolidation",
  content: {
    direct: { value: "Sleep improves memory consolidation" },
    full: { contentType: contentTypes.markdown, value: MARKDOWN },
  },
  createdAt: new Date("2026-06-12T14:00:00.000Z"),
  modifiedAt: new Date("2026-06-12T15:00:00.000Z"),
  authorId: "maparent",
};

const sharedNode = {
  rid: "orn:roam.node:MAPLab/tgWb6JozF",
  sourceLocalId: SOURCE_LOCAL_ID,
  spaceId: 20,
  spaceName: "MAPLab",
  spaceUri: "roam:MAPLab",
  platform: "Roam",
  title: "Sleep improves memory consolidation",
  created: null,
  lastModified: "2026-06-12T15:00:00.000Z",
  directMetadata: null,
} as unknown as SharedNode;

type Row = {
  filepath: string;
  filehash: string;
  source_path: string | null;
};

/**
 * One store standing in for Supabase across both halves: publication inserts into it and
 * import reads back out of it, so the rows the destination sees are the rows publication
 * actually wrote.
 */
const makeSharedStorage = () => {
  const rows: Row[] = [];
  const thenable = (result: unknown) => ({
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  });
  const selectChain = () => {
    const chain = {
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return chain;
  };
  const client = {
    rpc: vi.fn((_fn: string, { hashvalue }: { hashvalue: string }) =>
      Promise.resolve({
        data: rows.some((row) => row.filehash === hashvalue),
        error: null,
      }),
    ),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain()),
      delete: vi.fn(() => {
        const chain = {
          eq: () => chain,
          notIn: () => chain,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ error: null }).then(resolve),
        };
        return chain;
      }),
      insert: vi.fn((inserted: Row) => {
        rows.push({
          filepath: inserted.filepath,
          filehash: inserted.filehash,
          source_path: inserted.source_path ?? null,
        });
        return thenable({ error: null });
      }),
    })),
  } as unknown as DGSupabaseClient;
  return { client, rows };
};

/** Roam's storage: one asset readable, one unreadable, one past the publish cap. */
const stubRoamStorage = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      const url = input.split("?")[0] ?? input;
      if (url === UNREADABLE.split("?")[0])
        return Promise.resolve({
          ok: false,
          status: 500,
        } as unknown as Response);
      const size =
        url === OVERSIZED.split("?")[0] ? MAX_PUBLISHED_ASSET_BYTES + 1 : 7;
      if (!input.includes("alt=media"))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              name: "imgs/app/MAPLab/stored.png",
              contentType: "image/png",
              size: String(size),
              metadata: { "file-name": "diagram.png" },
            }),
        } as unknown as Response);
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode("PNGDATA").buffer),
      } as unknown as Response);
    }),
  );
};

const THIS_GRAPHS_COPY =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FOtherGraph%2FaB3dEf.png?alt=media&token=1122";

describe("asset degradation across both transfers", () => {
  let storage: ReturnType<typeof makeSharedStorage>;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = makeSharedStorage();
    stubRoamStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const publish = () =>
    publishNodeAssets({
      client: storage.client,
      spaceId: 20,
      nodes: [node],
    });

  it("leaves the token of every asset it could not store in the published markdown, and reports each one", async () => {
    const summary = summarizeAssetResults(await publish());

    expect(node.content.full?.value).toBe(MARKDOWN);
    expect(summary.failed.map((f) => f.sourceRef)).toEqual([UNREADABLE]);
    expect(summary.tooLarge.map((s) => s.sourceRef)).toEqual([OVERSIZED]);
    expect(summary.copied).toBe(1);
    expect(storage.rows.map((r) => r.filepath)).toEqual([STORED]);
  });

  it("imports the published markdown with its body intact, rewriting only what was stored", async () => {
    await publish();
    mirror.mockResolvedValue({
      status: "mirrored",
      contentHash: storage.rows[0].filehash,
      url: THIS_GRAPHS_COPY,
    });

    const { markdown, report } = await importNodeAssets({
      client: storage.client,
      sharedNode,
      markdown: MARKDOWN,
    });

    // Only the asset that reached shared storage was mirrored, so only its token moved.
    expect(mirror).toHaveBeenCalledTimes(1);
    expect(markdown).toContain(`![](${THIS_GRAPHS_COPY})`);
    // The rest of the node arrives exactly as published: the two tokens that never
    // became rows still point at Roam's world-readable originals, which is what makes
    // them render, and the external link was never ours to touch.
    expect(markdown).toContain(`![](${UNREADABLE})`);
    expect(markdown).toContain(`![](${OVERSIZED})`);
    expect(markdown).toContain(`[a paper](${EXTERNAL})`);
    expect(markdown).toContain("# Sleep improves memory consolidation");
    expect(markdown).toContain("- Supported by [[EVD]] - Rasch & Born 2013");
    expect(report).toMatchObject({ mirrored: 1, reused: 0, skipped: [] });
  });

  it("reports an asset that fails on the way in, leaving its token and the node body untouched", async () => {
    await publish();
    mirror.mockRejectedValue(new Error("upload refused"));

    const { markdown, report } = await importNodeAssets({
      client: storage.client,
      sharedNode,
      markdown: MARKDOWN,
    });

    expect(markdown).toBe(MARKDOWN);
    expect(report.failed).toEqual([
      { sourceRef: STORED, message: "upload refused" },
    ]);
  });
});
