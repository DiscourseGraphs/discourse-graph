import { beforeEach, describe, expect, it, vi } from "vitest";
import { DISCOURSE_GRAPH_PROP_NAME } from "~/utils/createReifiedBlock";
import type { json } from "~/utils/getBlockProps";
import internalError from "~/utils/internalError";
import type { NodeAssetResult } from "~/utils/publishNodeAssets";
import {
  NEEDS_REFRESH_PROP_KEY,
  requestAssetRetries,
} from "~/utils/requestAssetRetry";

vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));

const NODE_UID = "tgWb6JozF";
const OTHER_NODE_UID = "Xk3pQr8sT";
const IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FlqP2ioVNC3.png?alt=media&token=5e6f7a8b";
const SECOND_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FsecondImage.png?alt=media&token=1a2b3c4d";

type Block = { page: string; text: string };

const blocks = new Map<string, Block>();
const propsByUid = new Map<string, Record<string, json>>();
const update = vi.fn(
  ({ block }: { block: { uid: string; props: Record<string, json> } }) => {
    propsByUid.set(block.uid, block.props);
    return Promise.resolve();
  },
);

const query = vi.fn((_query: string, pageUid: string, url: string) =>
  Promise.resolve(
    [...blocks.entries()]
      .filter(([, block]) => block.page === pageUid && block.text.includes(url))
      .map(([uid]) => uid),
  ),
);

const failed = (sourceLocalId: string, sourceRef: string): NodeAssetResult => ({
  status: "failed",
  sourceLocalId,
  sourceRef,
  error: "descriptor 500",
});

const copied = (sourceLocalId: string, sourceRef: string): NodeAssetResult =>
  ({
    status: "copied",
    sourceLocalId,
    sourceRef,
    contentHash: "abc",
  }) as NodeAssetResult;

beforeEach(() => {
  blocks.clear();
  propsByUid.clear();
  update.mockClear();
  query.mockClear();
  vi.mocked(internalError).mockClear();
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: { async: { q: query }, block: { update } },
      pull: (_pattern: string, [, uid]: [string, string]) => ({
        ":block/props": propsByUid.get(uid) ?? {},
      }),
    },
  };
});

describe("requestAssetRetries", () => {
  it("marks the block holding a failed asset", async () => {
    blocks.set("imgBlock", {
      page: NODE_UID,
      text: `![](${IMAGE})`,
    });

    const retried = await requestAssetRetries([failed(NODE_UID, IMAGE)]);

    expect(retried).toEqual(new Set([NODE_UID]));
    expect(propsByUid.get("imgBlock")).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: { [NEEDS_REFRESH_PROP_KEY]: true },
    });
  });

  it("writes nothing when every asset copied", async () => {
    blocks.set("imgBlock", {
      page: NODE_UID,
      text: `![](${IMAGE})`,
    });

    const retried = await requestAssetRetries([copied(NODE_UID, IMAGE)]);

    expect(retried.size).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the block's existing props, including other discourse-graph data", async () => {
    blocks.set("imgBlock", {
      page: NODE_UID,
      text: `![](${IMAGE})`,
    });
    propsByUid.set("imgBlock", {
      other: "kept",
      [DISCOURSE_GRAPH_PROP_NAME]: { importedFrom: { sourceNodeRid: "rid" } },
    });

    await requestAssetRetries([failed(NODE_UID, IMAGE)]);

    expect(propsByUid.get("imgBlock")).toEqual({
      other: "kept",
      [DISCOURSE_GRAPH_PROP_NAME]: {
        importedFrom: { sourceNodeRid: "rid" },
        [NEEDS_REFRESH_PROP_KEY]: true,
      },
    });
  });

  it("writes once per node, however many of its assets failed", async () => {
    blocks.set("imgBlock", {
      page: NODE_UID,
      text: `![](${IMAGE})`,
    });
    blocks.set("secondBlock", {
      page: NODE_UID,
      text: `![](${SECOND_IMAGE})`,
    });

    await requestAssetRetries([
      failed(NODE_UID, IMAGE),
      failed(NODE_UID, SECOND_IMAGE),
    ]);

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not retry an asset that only reaches the node from another page", async () => {
    blocks.set("refSource", {
      page: OTHER_NODE_UID,
      text: `![](${IMAGE})`,
    });

    const retried = await requestAssetRetries([failed(NODE_UID, IMAGE)]);

    expect(retried.size).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses another failed asset's block when the first has none on the page", async () => {
    blocks.set("secondBlock", {
      page: NODE_UID,
      text: `![](${SECOND_IMAGE})`,
    });

    const retried = await requestAssetRetries([
      failed(NODE_UID, IMAGE),
      failed(NODE_UID, SECOND_IMAGE),
    ]);

    expect(retried).toEqual(new Set([NODE_UID]));
    expect(propsByUid.has("secondBlock")).toBe(true);
  });

  it("writes props only, so the block's last editor is kept", async () => {
    blocks.set("imgBlock", {
      page: NODE_UID,
      text: `![](${IMAGE})`,
    });

    await requestAssetRetries([failed(NODE_UID, IMAGE)]);

    const [[{ block }]] = update.mock.calls;
    expect(Object.keys(block).sort()).toEqual(["props", "uid"]);
  });

  it("reports a failed write and still marks the other nodes", async () => {
    blocks.set("imgBlock", {
      page: NODE_UID,
      text: `![](${IMAGE})`,
    });
    blocks.set("otherBlock", {
      page: OTHER_NODE_UID,
      text: `![](${IMAGE})`,
    });
    update.mockRejectedValueOnce(new Error("write refused"));

    const retried = await requestAssetRetries([
      failed(NODE_UID, IMAGE),
      failed(OTHER_NODE_UID, IMAGE),
    ]);

    expect(retried).toEqual(new Set([OTHER_NODE_UID]));
    expect(internalError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Asset retry failed",
        context: { sourceLocalId: NODE_UID },
      }),
    );
  });
});
