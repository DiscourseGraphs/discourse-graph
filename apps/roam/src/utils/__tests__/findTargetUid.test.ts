import { beforeEach, describe, expect, it, vi } from "vitest";
import { findTargetUid, sharedReferenceRid } from "~/utils/findTargetUid";
import { findImportedNodeUidBySourceRid } from "~/utils/importedSourceIdentity";

vi.mock("~/utils/importedSourceIdentity", () => ({
  findImportedNodeUidBySourceRid: vi.fn(),
}));

const mockedFindImportedNodeUidBySourceRid = vi.mocked(
  findImportedNodeUidBySourceRid,
);

const LOCAL_GRAPH = "local-graph";
const LOCAL_SPACE_URI = `https://roamresearch.com/#/app/${LOCAL_GRAPH}`;
const OBSIDIAN_SPACE_URI = "obsidian:vault-a";
const roamQuery = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { graph: { name: LOCAL_GRAPH }, q: roamQuery },
  };
  roamQuery.mockReturnValue([]);
  mockedFindImportedNodeUidBySourceRid.mockResolvedValue(null);
});

describe("sharedReferenceRid", () => {
  it("passes a RID through", () => {
    expect(
      sharedReferenceRid(
        "orn:obsidian.note:vault-b/node-6",
        OBSIDIAN_SPACE_URI,
      ),
    ).toBe("orn:obsidian.note:vault-b/node-6");
  });

  it("builds a note RID from a local id in an Obsidian space", () => {
    expect(sharedReferenceRid("node-9", OBSIDIAN_SPACE_URI)).toBe(
      "orn:obsidian.note:vault-a/node-9",
    );
  });

  it("builds a URL RID from a local id in a Roam space", () => {
    expect(
      sharedReferenceRid(
        "page-uid",
        "https://roamresearch.com/#/app/other-graph",
      ),
    ).toBe("https://roamresearch.com/#/app/other-graph/page-uid");
  });
});

describe("findTargetUid", () => {
  it("returns the local id of a RID in this graph when the page exists", async () => {
    roamQuery.mockReturnValue([[1]]);

    await expect(
      findTargetUid(`${LOCAL_SPACE_URI}/page-uid`, OBSIDIAN_SPACE_URI),
    ).resolves.toBe("page-uid");
    expect(roamQuery).toHaveBeenCalledWith(
      '[:find (?e) :where [?e :block/uid "page-uid"]]',
    );
    expect(mockedFindImportedNodeUidBySourceRid).not.toHaveBeenCalled();
  });

  it("returns null for a RID in this graph whose page is missing", async () => {
    await expect(
      findTargetUid(`${LOCAL_SPACE_URI}/page-uid`, OBSIDIAN_SPACE_URI),
    ).resolves.toBeNull();
    expect(mockedFindImportedNodeUidBySourceRid).not.toHaveBeenCalled();
  });

  it("looks up a local id of the publisher's space as an imported note", async () => {
    mockedFindImportedNodeUidBySourceRid.mockResolvedValue("imported-uid");

    await expect(findTargetUid("node-9", OBSIDIAN_SPACE_URI)).resolves.toBe(
      "imported-uid",
    );
    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledWith(
      "orn:obsidian.note:vault-a/node-9",
    );
    expect(roamQuery).not.toHaveBeenCalled();
  });

  it("looks up a RID of another space as imported", async () => {
    await expect(
      findTargetUid("orn:obsidian.note:vault-b/node-6", OBSIDIAN_SPACE_URI),
    ).resolves.toBeNull();
    expect(mockedFindImportedNodeUidBySourceRid).toHaveBeenCalledWith(
      "orn:obsidian.note:vault-b/node-6",
    );
  });
});
