import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: vi.fn(),
}));

vi.mock("~/utils/discourseNodeFormatToDatalog", () => ({
  default: vi.fn(() => []),
}));

import { resolveInitialReferencedNode } from "~/utils/resolveInitialReferencedNode";

const referencedNodeType = {
  backedBy: "user",
  canvasSettings: {},
  format: "@{content}",
  shortcut: "s",
  specification: [],
  text: "Source",
  type: "source-type-uid",
} as DiscourseNode;

describe("resolveInitialReferencedNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: { async: { fast: { q: mocks.query } } },
      },
    };
  });

  it("returns the matching node from the block's page or parents", async () => {
    mocks.query.mockResolvedValue([[{ ":node/title": "@Source" }]]);
    vi.mocked(getPageUidByPageTitle).mockReturnValue("source-uid");

    await expect(
      resolveInitialReferencedNode({
        blockUid: "block-uid",
        referencedNodeType,
      }),
    ).resolves.toEqual({ text: "@Source", uid: "source-uid" });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('[?b :block/uid "block-uid"]'),
    );
  });

  it("returns undefined when no referenced node is available", async () => {
    mocks.query.mockResolvedValue([]);

    await expect(
      resolveInitialReferencedNode({
        blockUid: "block-uid",
        referencedNodeType,
      }),
    ).resolves.toBeUndefined();
  });

  it("leaves the reference empty when the query fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.query.mockRejectedValue(new Error("query unavailable"));
      await expect(
        resolveInitialReferencedNode({
          blockUid: "block-uid",
          referencedNodeType,
        }),
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });

  it("does not query without both the block and referenced node type", async () => {
    await expect(
      resolveInitialReferencedNode({
        blockUid: undefined,
        referencedNodeType,
      }),
    ).resolves.toBeUndefined();

    await expect(
      resolveInitialReferencedNode({
        blockUid: "block-uid",
        referencedNodeType: null,
      }),
    ).resolves.toBeUndefined();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
