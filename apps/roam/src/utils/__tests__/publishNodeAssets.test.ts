import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { contentTypes } from "@repo/content-model";
import { MAX_ASSET_BYTES } from "@repo/database/lib/assetLimits";
import { publishNodeAssets, summarizeAssetResults } from "../publishNodeAssets";
import {
  IMAGE,
  makeClient,
  mockAssetReads,
} from "./fixtures/fileReferenceHarness";

const nodeWith = (markdown: string): CrossAppNode => ({
  localId: "tgWb6JozF",
  nodeType: "rCLM0schema",
  coreTitle: "Sleep improves memory consolidation",
  content: {
    direct: { value: "Sleep improves memory consolidation" },
    full: { contentType: contentTypes.markdown, value: markdown },
  },
  createdAt: new Date("2026-06-12T14:00:00.000Z"),
  modifiedAt: new Date("2026-06-12T15:00:00.000Z"),
  authorId: "maparent",
});

const MARKDOWN = `# Sleep improves memory consolidation\n\n![](${IMAGE})\n\n- Supported by [[EVD]] - Rasch & Born 2013\n`;

describe("publishNodeAssets", () => {
  let harness: ReturnType<typeof makeClient>;

  beforeEach(() => {
    harness = makeClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a reference whose filepath is the URL from the markdown", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results).toEqual([
      {
        status: "copied",
        sourceRef: IMAGE,
        sourceLocalId: "tgWb6JozF",
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
        sourcePath: "diagram.png",
      },
    ]);
    expect(harness.filepaths()).toEqual([IMAGE]);
  });

  it("leaves the published markdown untouched", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);

    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(node.content.full?.value).toBe(MARKDOWN);
  });

  it("publishes a node with no assets without recording anything", async () => {
    mockAssetReads({});
    const node = nodeWith("# A title\n\nJust prose.\n");

    await expect(
      publishNodeAssets({
        client: harness.client,
        spaceId: 20,
        nodes: [node],
      }),
    ).resolves.toEqual([]);
    expect(harness.rows).toHaveLength(0);
  });

  it("skips a node with no full content", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);
    delete node.content.full;

    await expect(
      publishNodeAssets({
        client: harness.client,
        spaceId: 20,
        nodes: [node],
      }),
    ).resolves.toEqual([]);
  });

  it("keeps the rows of a node whose content did not come through", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    // Absent content says nothing about what the node references, so removing its rows
    // would destroy data on the strength of a failed fetch.
    const withoutContent = nodeWith(MARKDOWN);
    delete withoutContent.content.full;
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [withoutContent],
    });

    expect(harness.filepaths()).toEqual([IMAGE]);
    expect(harness.deleteCount()).toBe(0);
  });

  it("carries an unfetchable asset out as a failure instead of throwing", async () => {
    mockAssetReads({ descriptorOk: false });
    const node = nodeWith(MARKDOWN);

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results).toEqual([
      {
        status: "failed",
        sourceRef: IMAGE,
        sourceLocalId: "tgWb6JozF",
        error: expect.stringContaining(
          "Could not read asset descriptor",
        ) as unknown,
      },
    ]);
    expect(node.content.full?.value).toBe(MARKDOWN);
  });

  it("carries an over-cap asset out as a skip", async () => {
    mockAssetReads({ size: MAX_ASSET_BYTES + 1 });
    const node = nodeWith(MARKDOWN);

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results[0]).toMatchObject({
      status: "skipped",
      reason: "too-large",
      sourceLocalId: "tgWb6JozF",
    });
    expect(harness.rows).toHaveLength(0);
  });

  it("attributes each asset to the node that references it", async () => {
    mockAssetReads({});
    const first = nodeWith(MARKDOWN);
    const second = { ...nodeWith(MARKDOWN), localId: "otherNode" };

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [first, second],
    });

    expect(results.map((r) => r.sourceLocalId)).toEqual([
      "tgWb6JozF",
      "otherNode",
    ]);
  });

  it("re-publishing an unchanged node fetches nothing and records nothing new", async () => {
    const { get } = mockAssetReads({});
    const node = nodeWith(MARKDOWN);
    const publish = () =>
      publishNodeAssets({ client: harness.client, spaceId: 20, nodes: [node] });

    await publish();
    const fetchesAfterFirst = vi.mocked(fetch).mock.calls.length;
    const readsAfterFirst = get.mock.calls.length;

    const results = await publish();

    // Both channels, since the bytes and the descriptor now travel separately.
    expect(vi.mocked(fetch).mock.calls).toHaveLength(fetchesAfterFirst);
    expect(get.mock.calls).toHaveLength(readsAfterFirst);
    expect(results).toEqual([
      {
        status: "unchanged",
        sourceRef: IMAGE,
        sourceLocalId: "tgWb6JozF",
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
        sourcePath: "diagram.png",
      },
    ]);
    expect(harness.filepaths()).toEqual([IMAGE]);
  });

  it("drops the reference to an asset the node no longer embeds", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);

    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });
    expect(harness.filepaths()).toEqual([IMAGE]);

    const withoutImage = nodeWith("# A title\n\nThe image is gone.\n");
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [withoutImage],
    });

    expect(harness.rows).toHaveLength(0);
  });

  it("leaves another node's references alone when cleaning up", async () => {
    mockAssetReads({});
    const other = { ...nodeWith(MARKDOWN), localId: "otherNode" };

    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [other],
    });
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [nodeWith("# A title\n\nNo assets here.\n")],
    });

    expect(harness.rows).toEqual([
      expect.objectContaining({
        source_local_id: "otherNode",
        filepath: IMAGE,
      }),
    ]);
  });

  it("reads every node's references in one query", async () => {
    mockAssetReads({});
    const nodes = ["n1", "n2", "n3"].map((localId) => ({
      ...nodeWith(MARKDOWN),
      localId,
    }));

    await publishNodeAssets({ client: harness.client, spaceId: 20, nodes });

    expect(harness.selectCount()).toBe(1);
  });

  it("issues no delete when the node has nothing stale to drop", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);

    // A first publish, then an unchanged re-publish: neither has a stale reference.
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(harness.deleteCount()).toBe(0);
  });

  it("replaces the reference when Roam rotates the download token", async () => {
    mockAssetReads({});
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [nodeWith(MARKDOWN)],
    });

    // The token is part of the URL, so a rotation reads as a different reference.
    const rotated = `${IMAGE.split("&token=")[0]}&token=rotated`;
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [nodeWith(MARKDOWN.replace(IMAGE, rotated))],
    });

    expect(harness.filepaths()).toEqual([rotated]);
  });

  it("keeps a still-referenced row when the node's references cannot be read", async () => {
    mockAssetReads({});
    const node = nodeWith(MARKDOWN);
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    harness.failReferenceRead("offline");

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results[0]).toMatchObject({ status: "failed", error: "offline" });
    expect(harness.filepaths()).toEqual([IMAGE]);
  });
});

describe("summarizeAssetResults", () => {
  it("counts copies and keeps skips and failures apart", () => {
    const summary = summarizeAssetResults([
      {
        status: "copied",
        sourceRef: "a",
        sourceLocalId: "n",
        contentHash: "h",
        sourcePath: "a.png",
      },
      {
        status: "skipped",
        sourceRef: "b",
        sourceLocalId: "n",
        sourcePath: "b.png",
        reason: "too-large",
        size: 99,
        limit: 10,
      },
      {
        status: "failed",
        sourceRef: "c",
        sourceLocalId: "n",
        error: "boom",
      },
    ]);

    expect(summary.copied).toBe(1);
    expect(summary.distinctBlobs).toBe(1);
    expect(summary.tooLarge.map((a) => a.sourceRef)).toEqual(["b"]);
    expect(summary.failed.map((a) => a.sourceRef)).toEqual(["c"]);
  });

  it("reports nothing outstanding when every asset copied", () => {
    const summary = summarizeAssetResults([
      {
        status: "copied",
        sourceRef: "a",
        sourceLocalId: "n",
        contentHash: "h",
        sourcePath: "a.png",
      },
    ]);

    expect(summary).toEqual({
      copied: 1,
      unchanged: 0,
      distinctBlobs: 1,
      tooLarge: [],
      failed: [],
    });
  });

  it("counts one blob when two nodes reference identical content", () => {
    const summary = summarizeAssetResults([
      {
        status: "copied",
        sourceRef: "a",
        sourceLocalId: "n1",
        contentHash: "h",
        sourcePath: "a.png",
      },
      {
        status: "copied",
        sourceRef: "b",
        sourceLocalId: "n2",
        contentHash: "h",
        sourcePath: "b.png",
      },
    ]);

    expect(summary.copied).toBe(2);
    expect(summary.distinctBlobs).toBe(1);
  });
});
