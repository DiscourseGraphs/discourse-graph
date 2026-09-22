import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { contentTypes } from "@repo/content-model";
import type { RoamFullContentNode } from "~/utils/convertRoamNodeToFullContent";
import type { SupabaseContext } from "~/utils/supabaseContext";
import {
  IMAGE,
  makeClient,
  mockAssetReads,
} from "./fixtures/fileReferenceHarness";

const mocks = vi.hoisted(() => ({
  /** The markdown Roam would render for each node, keyed by uid. */
  markdownByUid: new Map<string, string>(),
}));

// The sync module reads Roam globals when these load. None of them is on the path
// under test.
vi.mock("~/utils/getDiscourseNodes", () => ({ default: () => [] }));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/components/settings/utils/accessors", () => ({
  isSyncEnabled: () => false,
}));

vi.mock("~/utils/roamToCrossAppConverters", () => ({
  fullContentNodeToCrossApp: (node: RoamFullContentNode): CrossAppNode => ({
    localId: node.source_local_id,
    authorId: node.author_local_id,
    nodeType: node.node_type_id,
    coreTitle: node.text,
    createdAt: new Date(node.created),
    modifiedAt: new Date(node.last_modified),
    content: {
      direct: { localId: node.source_local_id, value: node.text },
      full: {
        localId: node.source_local_id,
        value: mocks.markdownByUid.get(node.source_local_id) ?? "",
        contentType: contentTypes.roamMarkdown,
        scale: "document",
      },
    },
  }),
}));

import { upsertSharedNodesFullContentWithAssets } from "~/utils/syncDgNodesToSupabase";

const NODE_UID = "tgWb6JozF";
const SECOND_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FsecondImage.png?alt=media&token=1a2b3c4d";

const sharedNode: RoamFullContentNode = {
  author_local_id: "maparent",
  source_local_id: NODE_UID,
  created: Date.parse("2026-06-12T14:00:00.000Z"),
  last_modified: Date.parse("2026-06-12T15:00:00.000Z"),
  text: "[[CLM]] - Sleep improves memory consolidation",
  node_type_id: "rCLM0schema",
  format: "[[CLM]] - {content}",
};

const context = { spaceId: 20, userId: 7 } as SupabaseContext;

const withImages = (...images: string[]): string =>
  [
    "# Sleep improves memory consolidation",
    ...images.map((image) => `![](${image})`),
    "- Supported by [[EVD]] - Rasch & Born 2013",
  ].join("\n\n");

describe("upsertSharedNodesFullContentWithAssets", () => {
  let harness: ReturnType<typeof makeClient>;

  const syncWithMarkdown = async (markdown: string) => {
    mocks.markdownByUid.set(NODE_UID, markdown);
    return upsertSharedNodesFullContentWithAssets({
      nodes: [sharedNode],
      supabaseClient: harness.client,
      context,
      phases: {},
    });
  };

  beforeEach(() => {
    harness = makeClient();
    mocks.markdownByUid.clear();
    mockAssetReads({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a reference for an image added after the node was shared", async () => {
    await syncWithMarkdown(withImages());
    expect(harness.rows).toHaveLength(0);

    await syncWithMarkdown(withImages(IMAGE));

    expect(harness.rows).toEqual([
      expect.objectContaining({ source_local_id: NODE_UID, filepath: IMAGE }),
    ]);
  });

  it("uploads the full content before recording references", async () => {
    await syncWithMarkdown(withImages(IMAGE));

    const { rpc, from } = harness;
    const contentUpload = rpc.mock.calls.findIndex(
      ([fn]) => fn === "upsert_content",
    );
    const referenceWrite = from.mock.calls.findIndex(
      ([table]) => table === "FileReference",
    );
    expect(contentUpload).toBeGreaterThanOrEqual(0);
    expect(referenceWrite).toBeGreaterThanOrEqual(0);
    expect(rpc.mock.invocationCallOrder[contentUpload]).toBeLessThan(
      from.mock.invocationCallOrder[referenceWrite],
    );
  });

  it("records no reference when the content upload fails", async () => {
    // FileReference has a foreign key to Content, so a reference must never outlive a
    // failed content upload.
    harness.failContentUpload("upsert_content failed");

    await expect(syncWithMarkdown(withImages(IMAGE))).rejects.toThrow();

    expect(harness.rows).toHaveLength(0);
    expect(
      harness.from.mock.calls.some(([table]) => table === "FileReference"),
    ).toBe(false);
  });

  it("neither adds nor removes references when only the text changes", async () => {
    await syncWithMarkdown(withImages(IMAGE));
    const rowsBefore = [...harness.rows];

    await syncWithMarkdown(`${withImages(IMAGE)}\n\n- A new bullet`);

    expect(harness.rows).toEqual(rowsBefore);
    expect(harness.deleteCount()).toBe(0);
  });

  it("removes the reference to an image the node no longer embeds", async () => {
    await syncWithMarkdown(withImages(IMAGE, SECOND_IMAGE));
    expect(harness.filepaths()).toEqual([IMAGE, SECOND_IMAGE]);

    await syncWithMarkdown(withImages(SECOND_IMAGE));

    expect(harness.filepaths()).toEqual([SECOND_IMAGE]);
  });

  it("does nothing when no shared node changed", async () => {
    // Timed even when empty, so a sync with no shared changes still reports both
    // phases rather than dropping them from the series.
    const phases: Record<string, number> = {};

    await expect(
      upsertSharedNodesFullContentWithAssets({
        nodes: [],
        supabaseClient: harness.client,
        context,
        phases,
      }),
    ).resolves.toEqual([]);

    expect(harness.rpc).not.toHaveBeenCalled();
    expect(Object.keys(phases)).toEqual([
      "upsertFullContent",
      "publishSharedNodeAssets",
    ]);
  });
});
