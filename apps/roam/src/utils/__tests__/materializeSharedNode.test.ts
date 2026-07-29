import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import {
  findImportedNodeUidBySourceRid,
  writeImportedSourceIdentity,
} from "~/utils/importedSourceIdentity";
import { materializeSharedNode } from "~/utils/materializeSharedNode";

vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/writes/createBlock", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/writes/createPage", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/writes/deleteBlock", () => ({ default: vi.fn() }));
vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));

const mockedGetPageTitleByPageUid = vi.mocked(getPageTitleByPageUid);
const mockedGetPageUidByPageTitle = vi.mocked(getPageUidByPageTitle);
const mockedGetShallowTreeByParentUid = vi.mocked(getShallowTreeByParentUid);
const mockedCreateBlock = vi.mocked(createBlock);
const mockedCreatePage = vi.mocked(createPage);
const mockedDeleteBlock = vi.mocked(deleteBlock);
const mockedFindImportedNodeUidBySourceRid = vi.mocked(
  findImportedNodeUidBySourceRid,
);
const mockedWriteImportedSourceIdentity = vi.mocked(
  writeImportedSourceIdentity,
);

const EXISTING_PAGE_UID = "existing-page-uid";

const updatePage = vi.fn();

const sharedNode: SharedNode = {
  rid: "orn:obsidian.note:vault-a/node-1",
  sourceLocalId: "node-1",
  spaceId: 20,
  spaceName: "Research vault",
  spaceUri: "obsidian:vault-a",
  platform: "Obsidian",
  title: "EVD - REM sleep and recall",
  created: "2026-06-14T12:30:00.000Z",
  lastModified: "2026-06-14T15:00:00.000Z",
  authorId: 7,
  directMetadata: null,
};

const FULL_MARKDOWN = [
  "---",
  "nodeTypeId: evidence",
  "---",
  "",
  "# Findings",
  "REM sleep improves recall",
].join("\n");

const FULL_TREE = [
  {
    text: "Findings",
    heading: 1,
    children: [{ text: "REM sleep improves recall", children: [] }],
  },
];

const clientWithFullContent = ({
  text,
  error,
}: {
  text?: string | null;
  error?: { message: string };
}): { client: DGSupabaseClient; from: ReturnType<typeof vi.fn> } => {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue(
      error
        ? { data: null, error }
        : { data: text === undefined ? null : { text }, error: null },
    );
  const eq = vi.fn();
  const chain = { eq, maybeSingle };
  eq.mockReturnValue(chain);
  const from = vi
    .fn()
    .mockReturnValue({ select: vi.fn().mockReturnValue(chain) });
  return { client: { from } as unknown as DGSupabaseClient, from };
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { updatePage },
  };
  mockedGetShallowTreeByParentUid.mockReturnValue([]);
});

describe("materializeSharedNode", () => {
  it("creates a Roam page with the parsed markdown and stores source identity", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(null);
    mockedGetPageUidByPageTitle.mockReturnValue("");
    mockedCreatePage.mockResolvedValue("new-page-uid");

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({ status: "created", pageUid: "new-page-uid" });
    expect(mockedCreatePage).toHaveBeenCalledWith({
      title: sharedNode.title,
      tree: FULL_TREE,
    });
    expect(mockedWriteImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: "new-page-uid",
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });
  });

  it("updates the existing imported page instead of creating a duplicate", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedGetShallowTreeByParentUid.mockReturnValue([
      { uid: "old-block", text: "stale" },
    ]);

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({ status: "updated", pageUid: EXISTING_PAGE_UID });
    expect(mockedCreatePage).not.toHaveBeenCalled();
    expect(updatePage).not.toHaveBeenCalled();
    expect(mockedDeleteBlock).toHaveBeenCalledWith("old-block");
    expect(mockedCreateBlock).toHaveBeenCalledWith({
      parentUid: EXISTING_PAGE_UID,
      order: 0,
      node: FULL_TREE[0],
    });
    expect(mockedWriteImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: EXISTING_PAGE_UID,
      sourceModifiedAt: sharedNode.lastModified,
      sourceNodeRid: sharedNode.rid,
    });
  });

  it("renames the imported page when the source title changed", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue("EVD - old title");
    mockedGetPageUidByPageTitle.mockReturnValue("");

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({ status: "updated", pageUid: EXISTING_PAGE_UID });
    expect(updatePage).toHaveBeenCalledWith({
      page: { uid: EXISTING_PAGE_UID, title: sharedNode.title },
    });
  });

  it("fails without writing when a local page already uses the title", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(null);
    mockedGetPageUidByPageTitle.mockReturnValue("unrelated-page-uid");

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain(
      sharedNode.title,
    );
    expect(mockedCreatePage).not.toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("fails the rename without touching content when the new title collides", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue("EVD - old title");
    mockedGetPageUidByPageTitle.mockReturnValue("unrelated-page-uid");

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.status).toBe("failed");
    expect(updatePage).not.toHaveBeenCalled();
    expect(mockedDeleteBlock).not.toHaveBeenCalled();
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("rejects nodes that are not Obsidian-origin before fetching content", async () => {
    const { client, from } = clientWithFullContent({ text: FULL_MARKDOWN });

    const result = await materializeSharedNode({
      client,
      sharedNode: { ...sharedNode, platform: "Roam" },
    });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("Roam");
    expect(from).not.toHaveBeenCalled();
  });

  it("fails with the fetch error and keeps identity untouched", async () => {
    const { client } = clientWithFullContent({
      error: { message: "permission denied" },
    });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain(
      "permission denied",
    );
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });

  it("materializes a title-only page when the node has no full content", async () => {
    const { client } = clientWithFullContent({});
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(null);
    mockedGetPageUidByPageTitle.mockReturnValue("");
    mockedCreatePage.mockResolvedValue("new-page-uid");

    await expect(
      materializeSharedNode({ client, sharedNode }),
    ).resolves.toEqual({ status: "created", pageUid: "new-page-uid" });
    expect(mockedCreatePage).toHaveBeenCalledWith({
      title: sharedNode.title,
      tree: [],
    });
  });

  it("reports the source RID when a write fails partway", async () => {
    const { client } = clientWithFullContent({ text: FULL_MARKDOWN });
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue(EXISTING_PAGE_UID);
    mockedGetPageTitleByPageUid.mockReturnValue(sharedNode.title);
    mockedCreateBlock.mockRejectedValue(new Error("block write failed"));

    const result = await materializeSharedNode({ client, sharedNode });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain(
      sharedNode.rid,
    );
    expect(result.status === "failed" && result.reason).toContain(
      "block write failed",
    );
    expect(mockedWriteImportedSourceIdentity).not.toHaveBeenCalled();
  });
});
