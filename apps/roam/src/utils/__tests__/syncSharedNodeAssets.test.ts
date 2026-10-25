import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { contentTypes } from "@repo/content-model";
import type { SupabaseContext } from "~/utils/supabaseContext";
import {
  IMAGE,
  makeClient,
  mockAssetReads,
} from "./fixtures/fileReferenceHarness";

// The sync module reads Roam globals when these load. None of them is on the path
// under test.
vi.mock("~/utils/getDiscourseNodes", () => ({ default: () => [] }));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
const capture = vi.hoisted(() => vi.fn());
vi.mock("posthog-js", () => ({ default: { capture } }));
vi.mock("~/components/settings/utils/accessors", () => ({
  isSyncEnabled: () => false,
}));

import {
  reportSharedNodeAssets,
  upsertNodesWithAssets,
} from "~/utils/syncDgNodesToSupabase";

const NODE_UID = "tgWb6JozF";
const SECOND_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FsecondImage.png?alt=media&token=1a2b3c4d";

const sharedNode = (markdown: string): CrossAppNode => ({
  localId: NODE_UID,
  authorId: "maparent",
  nodeType: "rCLM0schema",
  coreTitle: "Sleep improves memory consolidation",
  createdAt: new Date("2026-06-12T14:00:00.000Z"),
  modifiedAt: new Date("2026-06-12T15:00:00.000Z"),
  content: {
    direct: {
      localId: NODE_UID,
      value: "[[CLM]] - Sleep improves memory consolidation",
    },
    full: {
      localId: NODE_UID,
      value: markdown,
      contentType: contentTypes.roamMarkdown,
      scale: "document",
    },
  },
});

const context = { spaceId: 20, userId: 7 } as SupabaseContext;

const withImages = (...images: string[]): string =>
  [
    "# Sleep improves memory consolidation",
    ...images.map((image) => `![](${image})`),
    "- Supported by [[EVD]] - Rasch & Born 2013",
  ].join("\n\n");

describe("upsertNodesWithAssets", () => {
  let harness: ReturnType<typeof makeClient>;

  const syncWithMarkdown = (markdown: string) =>
    upsertNodesWithAssets({
      nodes: [sharedNode(markdown)],
      since: undefined,
      allNodeTypes: [],
      supabaseClient: harness.client,
      context,
      phases: {},
    });

  beforeEach(() => {
    harness = makeClient();
    mockAssetReads({});
    (
      window as unknown as { roamAlphaAPI: Record<string, unknown> }
    ).roamAlphaAPI.data = { backend: { q: () => Promise.resolve([]) } };
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

  it("upserts the node's Concept and Content before recording references", async () => {
    await syncWithMarkdown(withImages(IMAGE));

    const { rpc, from } = harness;
    const contentUpload = rpc.mock.calls.findIndex(
      ([fn]) => fn === "upsert_concepts",
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

  it("records no reference when the concept upsert fails", async () => {
    // FileReference has a foreign key to Content, so a reference must never outlive a
    // failed content upload.
    harness.failConceptUpsert("upsert_concepts failed");

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

  it("does nothing when there is no node to send", async () => {
    // Timed even when empty, so a sync with no shared changes still reports both
    // phases rather than dropping them from the series.
    const phases: Record<string, number> = {};

    await expect(
      upsertNodesWithAssets({
        nodes: [],
        since: undefined,
        allNodeTypes: [],
        supabaseClient: harness.client,
        context,
        phases,
      }),
    ).resolves.toEqual([]);

    expect(harness.rpc).not.toHaveBeenCalled();
    expect(Object.keys(phases)).toEqual([
      "convertConcepts",
      "publishSharedNodeAssets",
    ]);
  });
});

describe("reportSharedNodeAssets", () => {
  it("keeps the download token out of the failure event", () => {
    reportSharedNodeAssets({
      results: [
        {
          status: "failed",
          sourceLocalId: NODE_UID,
          sourceRef: IMAGE,
          error: `Could not fetch asset (HTTP 500): ${IMAGE}`,
        },
      ],
      retried: new Set([NODE_UID]),
    });

    const imagePath = IMAGE.split("?")[0];
    expect(capture).toHaveBeenCalledWith("Sync shared node asset failed", {
      sourceLocalId: NODE_UID,
      sourceRef: imagePath,
      error: `Could not fetch asset (HTTP 500): ${imagePath}`,
      retryScheduled: true,
    });
  });
});
